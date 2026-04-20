// Stage 10 Time Entries Schema Purpose
import { index, integer, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { baseColumns } from "./common";

export const timeEntryScopes = ["standalone", "session", "studio_booking", "admin"] as const;
export type TimeEntryScope = (typeof timeEntryScopes)[number];

export const timeEntries = pgTable(
  "time_entries",
  {
    ...baseColumns,
    scope: varchar("scope", { length: 32 }).$type<TimeEntryScope>().notNull(),
    scopeId: uuid("scope_id"),
    title: text("title").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMinutes: integer("duration_minutes").notNull().default(0),
    notes: text("notes"),
  },
  (table) => ({
    scopeStartedIndex: index("time_entries_scope_started_idx").on(table.scope, table.scopeId, table.startedAt),
    startedIndex: index("time_entries_started_idx").on(table.startedAt),
  }),
);
