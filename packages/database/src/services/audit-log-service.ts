// Stage 2 Audit Log Service Purpose
import { sql } from "drizzle-orm";
import type { StudioOsDatabase, StudioOsDatabaseExecutor } from "../client";
import { auditLog } from "../schema";
import { createUuid } from "../utils/uuid";

export type AuditLogRecordInput = {
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly actor: string;
  readonly loggedAt: Date;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
};

const formatBoundary = (value: Date): string => {
  const year = value.getUTCFullYear();
  const month = `${value.getUTCMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}-01T00:00:00.000Z`;
};

const addMonth = (value: Date): Date =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 1, 0, 0, 0, 0));

const ensuredPartitions = new Set<string>();

const emitPartitionFallbackMetric = (partitionName: string) => {
  console.warn(
    JSON.stringify({
      event: "audit.partition.fallback_created",
      partition_name: partitionName,
    }),
  );
  console.log(
    JSON.stringify({
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: "StudioOs/Audit",
            Dimensions: [["Stage", "Service"]],
            Metrics: [{ Name: "AuditPartitionFallbackCount", Unit: "Count" }],
          },
        ],
      },
      Stage: process.env.STAGE_NAME ?? "unknown",
      Service: "AuditLogService",
      AuditPartitionFallbackCount: 1,
    }),
  );
};

export class AuditLogService {
  public constructor(private readonly database: StudioOsDatabase) {}

  public async ensureMonthlyPartition(
    value: Date,
    executor: StudioOsDatabaseExecutor = this.database,
    options: { readonly suppressFallbackMetric?: boolean } = {},
  ): Promise<void> {
    const monthStart = new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 0, 0, 0, 0));
    const nextMonthStart = addMonth(monthStart);
    const partitionName = `audit_log_${monthStart.getUTCFullYear()}_${`${monthStart.getUTCMonth() + 1}`.padStart(2, "0")}`;
    if (ensuredPartitions.has(partitionName)) {
      return;
    }

    const existingPartition = await executor.execute(sql`select to_regclass(${partitionName})::text as partition_name`);
    const existingPartitionName = (existingPartition.rows[0] as { partition_name?: string | null } | undefined)?.partition_name;
    if (existingPartitionName) {
      ensuredPartitions.add(partitionName);
      return;
    }

    await executor.execute(
      sql.raw(
        `CREATE TABLE IF NOT EXISTS ${partitionName}
        PARTITION OF audit_log
        FOR VALUES FROM ('${formatBoundary(monthStart)}') TO ('${formatBoundary(nextMonthStart)}')`,
      ),
    );
    ensuredPartitions.add(partitionName);

    if (!options.suppressFallbackMetric) {
      emitPartitionFallbackMetric(partitionName);
    }
  }

  public async record(input: AuditLogRecordInput, executor: StudioOsDatabaseExecutor = this.database): Promise<void> {
    await this.ensureMonthlyPartition(input.loggedAt, executor);

    await executor.insert(auditLog).values({
      id: createUuid(),
      entityType: input.entityType,
      entityId: input.entityId,
      action: input.action,
      actor: input.actor,
      loggedAt: input.loggedAt,
      before: input.before,
      after: input.after,
      createdAt: input.loggedAt,
      updatedAt: input.loggedAt,
      deletedAt: null,
      version: 1,
    });
  }
}
