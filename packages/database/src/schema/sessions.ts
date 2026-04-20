// Stage 4 Sessions Schema Purpose
import { index, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns, requiredBoolean } from "./common";
import { clients } from "./clients";

export const sessionTypes = [
  "wedding",
  "engagement",
  "portrait",
  "family",
  "newborn",
  "headshot",
  "event",
  "commercial",
  "branding",
  "content_creation",
] as const;

export type SessionType = (typeof sessionTypes)[number];

export const sessionStatuses = [
  "scheduled",
  "confirmed",
  "in_progress",
  "completed",
  "in_post",
  "delivered",
  "archived",
  "cancelled",
] as const;

export type SessionStatus = (typeof sessionStatuses)[number];
export type SessionLocationCoords = { readonly lat?: number; readonly lng?: number };
export type SessionTimelineItem = Record<string, unknown>;
export type SessionWeatherForecast = Record<string, unknown>;

export const sessions = pgTable(
  "sessions",
  {
    ...baseColumns,
    clientId: uuid("client_id").references(() => clients.id).notNull(),
    sessionType: varchar("session_type", { length: 40 }).$type<SessionType>().notNull(),
    title: text("title").notNull(),
    status: varchar("status", { length: 32 }).$type<SessionStatus>().notNull().default("scheduled"),
    scheduledStart: timestamp("scheduled_start", { withTimezone: true }),
    scheduledEnd: timestamp("scheduled_end", { withTimezone: true }),
    actualStart: timestamp("actual_start", { withTimezone: true }),
    actualEnd: timestamp("actual_end", { withTimezone: true }),
    locationName: text("location_name"),
    locationAddress: text("location_address"),
    locationCoords: jsonb("location_coords").$type<SessionLocationCoords>().notNull().default(sql`'{}'::jsonb`),
    locationNotes: text("location_notes"),
    timeline: jsonb("timeline").$type<SessionTimelineItem[]>().notNull().default(sql`'[]'::jsonb`),
    secondShooterName: text("second_shooter_name"),
    assistantName: text("assistant_name"),
    gearNotes: text("gear_notes"),
    shotListId: uuid("shot_list_id"),
    contractId: uuid("contract_id"),
    questionnaireResponseId: uuid("questionnaire_response_id"),
    invoiceIds: text("invoice_ids").array().notNull().default(sql`'{}'::text[]`),
    galleryId: uuid("gallery_id"),
    weatherForecast: jsonb("weather_forecast").$type<SessionWeatherForecast>().notNull().default(sql`'{}'::jsonb`),
    usesOwnStudio: requiredBoolean("uses_own_studio", false),
    notes: text("notes"),
  },
  (table) => ({
    clientScheduledIndex: index("sessions_client_scheduled_idx").on(table.clientId, table.scheduledStart),
    statusScheduledIndex: index("sessions_status_scheduled_idx").on(table.status, table.scheduledStart),
  }),
);
