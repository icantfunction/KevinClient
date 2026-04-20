// Stage 2 Audit Log Schema Purpose
import { index, jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./common";

export type AuditDocument = Record<string, unknown> | null;

export const auditLog = pgTable(
  "audit_log",
  {
    ...baseColumns,
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    action: varchar("action", { length: 120 }).notNull(),
    actor: varchar("actor", { length: 160 }).notNull(),
    loggedAt: timestamp("logged_at", { withTimezone: true }).notNull().default(sql`CURRENT_TIMESTAMP`),
    before: jsonb("before").$type<AuditDocument>(),
    after: jsonb("after").$type<AuditDocument>(),
  },
  (table) => ({
    entityIndex: index("audit_log_entity_idx").on(table.entityType, table.entityId, table.loggedAt),
    actorIndex: index("audit_log_actor_idx").on(table.actor, table.loggedAt),
  }),
);
