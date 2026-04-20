// Stage 4 Shot Lists Schema Purpose
import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./common";

export type ShotListItem = {
  readonly id: string;
  readonly description: string;
  readonly mustHave: boolean;
  readonly captured: boolean;
  readonly referenceImageS3Key?: string | null;
  readonly notes?: string | null;
};

export const shotLists = pgTable(
  "shot_lists",
  {
    ...baseColumns,
    sessionId: uuid("session_id").notNull().unique(),
    items: jsonb("items").$type<ShotListItem[]>().notNull().default(sql`'[]'::jsonb`),
    notes: text("notes"),
  },
  (table) => ({
    sessionIndex: index("shot_lists_session_idx").on(table.sessionId),
  }),
);
