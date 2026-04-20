// Stage 2 Common Schema Purpose
import { boolean, integer, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const baseColumns = {
  id: uuid("id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  version: integer("version").notNull(),
};

export const actorColumn = varchar("actor", { length: 160 }).notNull();
export const notesColumn = text("notes");
export const requiredBoolean = (name: string, defaultValue: boolean) => boolean(name).notNull().default(defaultValue);
