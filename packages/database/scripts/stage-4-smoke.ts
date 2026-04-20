// Stage 4 Database Smoke Script Purpose
import {
  ActivitiesService,
  ClientsService,
  SessionsService,
  ShotListsService,
  TasksService,
  buildSessionTaskTemplates,
  createDatabaseClient,
} from "../src/index";
import { createUuid } from "../src/utils/uuid";
import { applyStageEnvironment } from "./shared";

const run = async () => {
  await applyStageEnvironment();

  const database = createDatabaseClient();
  const actor = "system:stage-4-smoke";
  const now = new Date();
  const clientsService = new ClientsService(database);
  const sessionsService = new SessionsService(database);
  const shotListsService = new ShotListsService(database);
  const tasksService = new TasksService(database);
  const activitiesService = new ActivitiesService(database);

  const client = await clientsService.createClient(
    {
      clientType: "photo",
      primaryName: "Stage 4 Session Client",
      email: "stage4-client@example.com",
      phone: "+19545550004",
    },
    { actor, occurredAt: now },
  );

  const scheduledStart = new Date("2026-06-20T18:00:00.000Z");
  const scheduledEnd = new Date("2026-06-20T20:00:00.000Z");
  const session = await sessionsService.createSession(
    {
      clientId: client.id,
      sessionType: "engagement",
      title: "Sunset engagement session",
      status: "confirmed",
      scheduledStart,
      scheduledEnd,
      locationName: "Las Olas Beach",
      locationAddress: "Fort Lauderdale, FL",
    },
    { actor, occurredAt: now },
  );

  const shotList = await shotListsService.upsertShotList(
    {
      sessionId: session.id,
      items: [
        {
          id: createUuid(),
          description: "Wide shoreline portrait",
          mustHave: true,
          captured: false,
          notes: "Golden hour",
        },
      ],
    },
    { actor, occurredAt: now },
  );

  await sessionsService.attachShotList(session.id, shotList.id, { actor, occurredAt: now });

  for (const taskTemplate of buildSessionTaskTemplates("engagement").slice(0, 3)) {
    await tasksService.createTask(
      {
        scope: "session",
        scopeId: session.id,
        title: taskTemplate.title,
        description: taskTemplate.description,
        priority: taskTemplate.priority,
        dueAt: new Date(scheduledStart.getTime() + taskTemplate.offsetDays * 24 * 60 * 60 * 1000),
      },
      { actor, occurredAt: now },
    );
  }

  await activitiesService.createActivity(
    {
      clientId: client.id,
      scopeType: "session",
      scopeId: session.id,
      channel: "note",
      direction: "internal",
      activityType: "session.created",
      subject: session.title,
      body: "Stage 4 smoke session created.",
      occurredAt: now,
    },
    { actor, occurredAt: now },
  );

  const calendar = await sessionsService.listCalendarEntries(
    new Date("2026-06-01T00:00:00.000Z"),
    new Date("2026-06-30T23:59:59.000Z"),
  );
  const dashboard = await sessionsService.getDashboardSummary(now);
  const sessionTasks = await tasksService.listTasks({
    scope: "session",
    scopeId: session.id,
    limit: 10,
  });

  console.log(
    JSON.stringify(
      {
        clientId: client.id,
        sessionId: session.id,
        shotListId: shotList.id,
        calendarEntries: calendar.length,
        dashboard,
        sessionTaskCount: sessionTasks.length,
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
