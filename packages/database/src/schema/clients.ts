// Stage 2 Clients Schema Purpose
import { index, integer, jsonb, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns, requiredBoolean } from "./common";

export type AddressJson = Record<string, unknown>;

export const clients = pgTable(
  "clients",
  {
    ...baseColumns,
    clientType: varchar("client_type", { length: 32 }).$type<"photo" | "studio_renter" | "both">().notNull(),
    primaryName: text("primary_name").notNull(),
    partnerName: text("partner_name"),
    businessName: text("business_name"),
    email: text("email"),
    secondaryEmail: text("secondary_email"),
    phone: text("phone"),
    mailingAddress: jsonb("mailing_address").$type<AddressJson>().notNull().default(sql`'{}'::jsonb`),
    billingAddress: jsonb("billing_address").$type<AddressJson>().notNull().default(sql`'{}'::jsonb`),
    referralSource: text("referral_source"),
    howWeMet: text("how_we_met"),
    lifetimeValueCents: integer("lifetime_value_cents").notNull().default(0),
    firstBookedAt: timestamp("first_booked_at", { withTimezone: true }),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    vip: requiredBoolean("vip", false),
    blocked: requiredBoolean("blocked", false),
    notes: text("notes"),
  },
  (table) => ({
    primaryNameIndex: index("clients_primary_name_idx").on(table.primaryName),
    emailIndex: index("clients_email_idx").on(table.email),
    phoneIndex: index("clients_phone_idx").on(table.phone),
  }),
);
