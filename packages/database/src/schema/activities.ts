// Stage 2 Activities Schema Purpose
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./common";
import { clients } from "./clients";

export type ActivityMetadata = Record<string, unknown>;

export const activities = pgTable(
  "activities",
  {
    ...baseColumns,
    clientId: uuid("client_id").references(() => clients.id),
    scopeType: varchar("scope_type", { length: 80 }).notNull(),
    scopeId: uuid("scope_id"),
    channel: varchar("channel", { length: 24 }).$type<"email" | "sms" | "note" | "system">().notNull(),
    direction: varchar("direction", { length: 24 }).$type<"inbound" | "outbound" | "internal" | "system">().notNull(),
    activityType: varchar("activity_type", { length: 120 }).notNull(),
    subject: text("subject"),
    body: text("body"),
    metadata: jsonb("metadata").$type<ActivityMetadata>().notNull().default(sql`'{}'::jsonb`),
    externalMessageId: text("external_message_id"),
    inReplyTo: text("in_reply_to"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (table) => ({
    clientOccurredIndex: index("activities_client_occurred_idx").on(table.clientId, table.occurredAt),
    scopeIndex: index("activities_scope_idx").on(table.scopeType, table.scopeId),
    externalMessageIdIndex: index("activities_external_message_id_idx").on(table.externalMessageId),
  }),
);
