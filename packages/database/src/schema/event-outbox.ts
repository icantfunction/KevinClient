// Stage 11.5 Event Outbox Schema Purpose
import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./common";

export type OutboxDetailDocument = Record<string, unknown>;

export const eventOutbox = pgTable(
  "event_outbox",
  {
    ...baseColumns,
    entityType: varchar("entity_type", { length: 120 }).notNull(),
    entityId: uuid("entity_id").notNull(),
    eventName: varchar("event_name", { length: 120 }).notNull(),
    detail: jsonb("detail").$type<OutboxDetailDocument>().notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    attemptCount: integer("attempt_count").notNull().default(0),
    lastError: text("last_error"),
  },
  (table) => ({
    publishedCreatedIndex: index("event_outbox_published_created_idx").on(table.publishedAt, table.createdAt),
    entityIndex: index("event_outbox_entity_idx").on(table.entityType, table.entityId, table.createdAt),
    attemptIndex: index("event_outbox_attempt_idx").on(table.attemptCount, table.createdAt),
    pendingCreatedIndex: index("event_outbox_pending_created_idx").on(table.createdAt, table.id).where(sql`${table.publishedAt} is null`),
  }),
);
