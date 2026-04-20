// Stage 11.5 Audit Partition Precreate Lambda Purpose
import { AuditLogService, createDatabaseClient } from "@studio-os/database";

const startOfUtcMonth = (value: Date) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1, 0, 0, 0, 0));

const addMonths = (value: Date, months: number) =>
  new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + months, 1, 0, 0, 0, 0));

export const handler = async () => {
  const database = createDatabaseClient();
  const auditLogService = new AuditLogService(database);
  const anchor = startOfUtcMonth(new Date());
  const targets = [addMonths(anchor, 1), addMonths(anchor, 2)];

  for (const target of targets) {
    await auditLogService.ensureMonthlyPartition(target, database, {
      suppressFallbackMetric: true,
    });
  }

  return {
    ensuredMonths: targets.map((value) => value.toISOString().slice(0, 7)),
  };
};
