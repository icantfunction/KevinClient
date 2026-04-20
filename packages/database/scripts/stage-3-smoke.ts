// Stage 3 Database Smoke Script Purpose
import { sql } from "drizzle-orm";
import {
  ActivitiesService,
  ClientsService,
  InquiriesService,
  TasksService,
  createDatabaseClient,
} from "../src/index";
import { applyStageEnvironment } from "./shared";

const run = async () => {
  await applyStageEnvironment();

  const database = createDatabaseClient();
  const actor = "system:stage-3-smoke";
  const clientsService = new ClientsService(database);
  const activitiesService = new ActivitiesService(database);
  const inquiriesService = new InquiriesService(database);
  const tasksService = new TasksService(database);

  const now = new Date();
  const client = await clientsService.createClient(
    {
      clientType: "photo",
      primaryName: "Stage 3 Client",
      email: "stage3-client@example.com",
      phone: "+19545550003",
    },
    { actor, occurredAt: now },
  );

  const inquiry = await inquiriesService.createInquiry(
    {
      inquirerName: "Stage 3 Lead",
      email: "stage3-client@example.com",
      phone: "+19545550003",
      eventType: "wedding",
      eventLocation: "Miami, FL",
      message: "Looking for wedding coverage.",
      budgetRange: "$4k-$6k",
      referralSource: "Instagram",
    },
    { actor, occurredAt: now },
  );

  const activity = await activitiesService.createActivity(
    {
      clientId: client.id,
      scopeType: "inquiry",
      scopeId: inquiry.id,
      channel: "email",
      direction: "inbound",
      activityType: "inquiry.received",
      subject: "New website inquiry",
      body: "Looking for wedding coverage.",
      externalMessageId: `<stage3-${inquiry.id}@example.com>`,
      occurredAt: now,
    },
    { actor, occurredAt: now },
  );

  await tasksService.createTask(
    {
      scope: "admin",
      title: "Reply to Stage 3 inquiry",
      description: `Follow up with inquiry ${inquiry.id}`,
      dueAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
    },
    { actor, occurredAt: now },
  );

  const matchedClient = await clientsService.findClientByContact("stage3-client@example.com", null);
  const inbox = await activitiesService.listInbox({ unreadOnly: true, limit: 10 });
  const timeline = await activitiesService.getClientTimeline(client.id, 10);
  const counts = await database.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM inquiries WHERE deleted_at IS NULL) AS inquiry_count,
      (SELECT COUNT(*)::int FROM activities WHERE deleted_at IS NULL) AS activity_count
  `);

  console.log(
    JSON.stringify(
      {
        clientId: client.id,
        inquiryId: inquiry.id,
        activityId: activity.id,
        matchedClientId: matchedClient?.id ?? null,
        inboxCount: inbox.length,
        timelineCount: timeline.length,
        counts: counts.rows[0] ?? null,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
