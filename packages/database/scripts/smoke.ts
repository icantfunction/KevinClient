// Stage 2 Smoke Script Purpose
import { sql } from "drizzle-orm";
import { createDatabaseClient } from "../src/client";
import { activities, auditLog, clients, tasks } from "../src/schema";
import { ActivitiesService } from "../src/services/activities-service";
import { AuditLogService } from "../src/services/audit-log-service";
import { ClientsService } from "../src/services/clients-service";
import { TasksService } from "../src/services/tasks-service";
import { applyStageEnvironment } from "./shared";

const main = async () => {
  await applyStageEnvironment();
  const database = createDatabaseClient();
  const clientService = new ClientsService(database);
  const activitiesService = new ActivitiesService(database);
  const tasksService = new TasksService(database);
  const auditService = new AuditLogService(database);
  const actor = "system";
  const occurredAt = new Date();

  await auditService.ensureMonthlyPartition(occurredAt);

  const client = await clientService.createClient(
    {
      clientType: "photo",
      primaryName: `Stage 2 Smoke ${occurredAt.toISOString()}`,
      email: `stage2-smoke-${occurredAt.getTime()}@example.com`,
      phone: "+15555550123",
      tags: ["stage-2", "smoke"],
      notes: "Stage 2 smoke test client record.",
    },
    { actor, occurredAt },
  );

  const activity = await activitiesService.createActivity(
    {
      clientId: client.id,
      scopeType: "client",
      scopeId: client.id,
      channel: "system",
      direction: "system",
      activityType: "smoke_test",
      subject: "Stage 2 smoke activity",
      body: "Created during Stage 2 verification.",
      metadata: { test: true },
      occurredAt,
    },
    { actor, occurredAt },
  );

  const task = await tasksService.createTask(
    {
      scope: "admin",
      title: "Stage 2 smoke task",
      description: "Created during Stage 2 verification.",
      notes: "Safe to ignore.",
    },
    { actor, occurredAt },
  );

  const rowCounts = await database.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM ${clients}) AS client_count,
      (SELECT COUNT(*)::int FROM ${activities}) AS activity_count,
      (SELECT COUNT(*)::int FROM ${tasks}) AS task_count,
      (SELECT COUNT(*)::int FROM ${auditLog}) AS audit_count
  `);

  console.log(
    JSON.stringify(
      {
        clientId: client.id,
        activityId: activity.id,
        taskId: task.id,
        rowCounts: rowCounts.rows[0] ?? null,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
