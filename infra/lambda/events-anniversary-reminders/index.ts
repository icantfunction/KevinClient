// Stage 9 Anniversary Reminders Lambda Purpose
import { and, eq, gte, isNull, sql } from "drizzle-orm";
import { clients, sessions, studioBookings } from "@studio-os/database";
import { createStage3Services } from "../shared/database";
import { ensureAutomationTask, sendAutomationSms } from "../shared/automation-notifications";

const kevinPhoneNumber = process.env.STUDIO_OS_ALLOWED_PHONE_NUMBER?.trim();
const millisecondsPerDay = 24 * 60 * 60 * 1000;

export const handler = async () => {
  const now = new Date();
  const {
    activitiesService,
    database,
    tasksService,
  } = createStage3Services();

  const currentMonth = now.getUTCMonth() + 1;
  const currentDay = now.getUTCDate();

  const weddingSessions = await database
    .select({
      sessionId: sessions.id,
      clientId: sessions.clientId,
      title: sessions.title,
      scheduledStart: sessions.scheduledStart,
      clientName: clients.primaryName,
    })
    .from(sessions)
    .innerJoin(clients, eq(clients.id, sessions.clientId))
    .where(
      and(
        isNull(sessions.deletedAt),
        isNull(clients.deletedAt),
        eq(sessions.sessionType, "wedding"),
        sql`extract(month from ${sessions.scheduledStart}) = ${currentMonth}`,
        sql`extract(day from ${sessions.scheduledStart}) = ${currentDay}`,
        sql`extract(year from ${sessions.scheduledStart}) < ${now.getUTCFullYear()}`,
      ),
    );

  let anniversaryAlertsSent = 0;
  for (const session of weddingSessions) {
    if (!kevinPhoneNumber) {
      continue;
    }

    const result = await sendAutomationSms({
      services: { activitiesService },
      externalMessageId: `anniversary:wedding:${session.sessionId}:${now.getUTCFullYear()}`,
      actor: "system",
      occurredAt: now,
      clientId: session.clientId,
      scopeType: "session",
      scopeId: session.sessionId,
      activityType: "session.anniversary_reminder",
      recipientPhone: kevinPhoneNumber,
      body: `Wedding anniversary reminder: ${session.clientName} (${session.title}) is celebrating today.`,
    });

    if (!result.duplicate) {
      anniversaryAlertsSent += 1;
    }
  }

  const recentThreshold = new Date(now.getTime() - 730 * millisecondsPerDay);
  const dormantThreshold = new Date(now.getTime() - 180 * millisecondsPerDay);

  const recentSessionRows = await database
    .select({
      clientId: sessions.clientId,
      happenedAt: sessions.scheduledStart,
    })
    .from(sessions)
    .where(and(isNull(sessions.deletedAt), gte(sessions.scheduledStart, recentThreshold)));

  const recentBookingRows = await database
    .select({
      clientId: studioBookings.clientId,
      happenedAt: studioBookings.bookingStart,
    })
    .from(studioBookings)
    .where(and(isNull(studioBookings.deletedAt), gte(studioBookings.bookingStart, recentThreshold)));

  const bookingStats = new Map<string, { count: number; lastBookedAt: Date | null }>();
  for (const row of [...recentSessionRows, ...recentBookingRows]) {
    const current = bookingStats.get(row.clientId) ?? {
      count: 0,
      lastBookedAt: null,
    };
    current.count += 1;
    if (row.happenedAt && (!current.lastBookedAt || row.happenedAt > current.lastBookedAt)) {
      current.lastBookedAt = row.happenedAt;
    }
    bookingStats.set(row.clientId, current);
  }

  let dormantClientTasksCreated = 0;
  for (const [clientId, stat] of bookingStats.entries()) {
    if (stat.count < 2 || !stat.lastBookedAt || stat.lastBookedAt >= dormantThreshold) {
      continue;
    }

    const clientRow = await database
      .select()
      .from(clients)
      .where(and(eq(clients.id, clientId), isNull(clients.deletedAt)))
      .limit(1);
    const client = clientRow[0];
    if (!client) {
      continue;
    }

    const task = await ensureAutomationTask({
      tasksService,
      actor: "system",
      occurredAt: now,
      scope: "admin",
      title: `Follow up with dormant repeat client ${client.primaryName}`,
      description: `${client.primaryName} has booked ${stat.count} times in the last 24 months but has been inactive for 180+ days.`,
      priority: "medium",
      dueAt: now,
      notes: client.id,
    });

    if (task.created) {
      dormantClientTasksCreated += 1;
    }
  }

  return {
    anniversaryAlertsSent,
    dormantClientTasksCreated,
  };
};
