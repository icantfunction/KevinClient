// Stage 2 Tasks Schema Purpose
import { index, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "./common";

export const tasks = pgTable(
  "tasks",
  {
    ...baseColumns,
    scope: varchar("scope", { length: 32 }).$type<"standalone" | "session" | "studio_booking" | "admin">().notNull(),
    scopeId: uuid("scope_id"),
    title: text("title").notNull(),
    description: text("description"),
    status: varchar("status", { length: 32 }).$type<"todo" | "doing" | "waiting_client" | "waiting_vendor" | "blocked" | "done">().notNull(),
    priority: varchar("priority", { length: 32 }).$type<"low" | "medium" | "high" | "urgent">().notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    actualDoneAt: timestamp("actual_done_at", { withTimezone: true }),
    blockedReason: text("blocked_reason"),
    recurringRule: varchar("recurring_rule", { length: 512 }),
    notes: text("notes"),
  },
  (table) => ({
    statusDueAtIndex: index("tasks_status_due_at_idx").on(table.status, table.dueAt),
    scopeIndex: index("tasks_scope_idx").on(table.scope, table.scopeId),
  }),
);
