// Stage 3 Inquiries Schema Purpose
import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns } from "./common";

export const inquiryEventTypes = [
  "wedding",
  "engagement",
  "portrait",
  "family",
  "newborn",
  "maternity",
  "headshot",
  "event",
  "commercial",
  "branding",
  "content_creation",
  "studio_rental",
  "other",
] as const;

export type InquiryEventType = (typeof inquiryEventTypes)[number];

export const inquiryStatuses = [
  "new",
  "responded",
  "proposal_sent",
  "follow_up_needed",
  "booked",
  "lost",
  "ghosted",
] as const;

export type InquiryStatus = (typeof inquiryStatuses)[number];
export type InquiryMetadata = Record<string, unknown>;

export const inquiries = pgTable(
  "inquiries",
  {
    ...baseColumns,
    inquirerName: text("inquirer_name").notNull(),
    email: text("email"),
    phone: text("phone"),
    eventType: varchar("event_type", { length: 40 }).$type<InquiryEventType>().notNull(),
    eventDate: timestamp("event_date", { withTimezone: true }),
    eventLocation: text("event_location"),
    estimatedGuestCount: integer("estimated_guest_count"),
    budgetRange: text("budget_range"),
    referralSource: text("referral_source"),
    message: text("message"),
    status: varchar("status", { length: 32 }).$type<InquiryStatus>().notNull().default("new"),
    lostReason: text("lost_reason"),
    assignedSmartFileId: uuid("assigned_smart_file_id"),
    notes: text("notes"),
    metadata: jsonb("metadata").$type<InquiryMetadata>().notNull().default(sql`'{}'::jsonb`),
  },
  (table) => ({
    statusIndex: index("inquiries_status_idx").on(table.status, table.eventDate),
    emailIndex: index("inquiries_email_idx").on(table.email),
    phoneIndex: index("inquiries_phone_idx").on(table.phone),
  }),
);
