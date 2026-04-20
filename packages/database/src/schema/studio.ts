// Stage 7 Studio Schema Purpose
import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns, requiredBoolean } from "./common";
import { clients } from "./clients";

export const studioSpaceStatuses = ["active", "inactive"] as const;

export const studioBookingStatuses = [
  "inquiry",
  "hold",
  "confirmed",
  "in_use",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type StudioBookingStatus = (typeof studioBookingStatuses)[number];

export type StudioAvailabilityRules = Record<string, unknown>;
export type StudioPricingBreakdown = Record<string, unknown>;

export type StudioBookingEquipmentItemInput = {
  readonly equipmentId: string;
  readonly quantity: number;
};

export const studioSpaces = pgTable(
  "studio_spaces",
  {
    ...baseColumns,
    name: text("name").notNull(),
    description: text("description"),
    capacity: integer("capacity").notNull().default(1),
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
    halfDayRateCents: integer("half_day_rate_cents").notNull().default(0),
    fullDayRateCents: integer("full_day_rate_cents").notNull().default(0),
    minBookingHours: integer("min_booking_hours").notNull().default(1),
    bufferMinutes: integer("buffer_minutes").notNull().default(0),
    amenities: text("amenities").array().notNull().default(sql`'{}'::text[]`),
    includedEquipment: text("included_equipment").array().notNull().default(sql`'{}'::text[]`),
    houseRules: text("house_rules"),
    coverImageS3Key: text("cover_image_s3_key"),
    galleryImageS3Keys: text("gallery_image_s3_keys").array().notNull().default(sql`'{}'::text[]`),
    availabilityRules: jsonb("availability_rules").$type<StudioAvailabilityRules>().notNull().default(sql`'{}'::jsonb`),
    active: requiredBoolean("active", true),
  },
  (table) => ({
    activeNameIndex: index("studio_spaces_active_name_idx").on(table.active, table.name),
  }),
);

export const studioEquipment = pgTable(
  "studio_equipment",
  {
    ...baseColumns,
    name: text("name").notNull(),
    description: text("description"),
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
    dailyRateCents: integer("daily_rate_cents").notNull().default(0),
    replacementCostCents: integer("replacement_cost_cents").notNull().default(0),
    quantityOwned: integer("quantity_owned").notNull().default(0),
    quantityAvailable: integer("quantity_available").notNull().default(0),
    conditionNotes: text("condition_notes"),
    lastServicedAt: timestamp("last_serviced_at", { withTimezone: true }),
    images: text("images").array().notNull().default(sql`'{}'::text[]`),
    active: requiredBoolean("active", true),
  },
  (table) => ({
    activeNameIndex: index("studio_equipment_active_name_idx").on(table.active, table.name),
  }),
);

export const studioBookings = pgTable(
  "studio_bookings",
  {
    ...baseColumns,
    clientId: uuid("client_id").references(() => clients.id).notNull(),
    spaceId: uuid("space_id").references(() => studioSpaces.id).notNull(),
    status: varchar("status", { length: 32 }).$type<StudioBookingStatus>().notNull().default("inquiry"),
    bookingStart: timestamp("booking_start", { withTimezone: true }).notNull(),
    bookingEnd: timestamp("booking_end", { withTimezone: true }).notNull(),
    durationHours: text("duration_hours"),
    partySize: integer("party_size"),
    purpose: text("purpose"),
    needsCleanupCrew: requiredBoolean("needs_cleanup_crew", false),
    needsLightingAssist: requiredBoolean("needs_lighting_assist", false),
    pricingBreakdown: jsonb("pricing_breakdown").$type<StudioPricingBreakdown>().notNull().default(sql`'{}'::jsonb`),
    depositAmountCents: integer("deposit_amount_cents").notNull().default(0),
    depositPaid: requiredBoolean("deposit_paid", false),
    balanceDueAt: timestamp("balance_due_at", { withTimezone: true }),
    balancePaid: requiredBoolean("balance_paid", false),
    liabilityWaiverId: uuid("liability_waiver_id"),
    accessCode: varchar("access_code", { length: 6 }),
    accessValidFrom: timestamp("access_valid_from", { withTimezone: true }),
    accessValidUntil: timestamp("access_valid_until", { withTimezone: true }),
    checkinAt: timestamp("checkin_at", { withTimezone: true }),
    checkoutAt: timestamp("checkout_at", { withTimezone: true }),
    damageNoted: requiredBoolean("damage_noted", false),
    damageNotes: text("damage_notes"),
    damageChargeCents: integer("damage_charge_cents").notNull().default(0),
    reviewRating: integer("review_rating"),
    reviewText: text("review_text"),
    holdExpiresAt: timestamp("hold_expires_at", { withTimezone: true }),
    notes: text("notes"),
  },
  (table) => ({
    clientStartIndex: index("studio_bookings_client_start_idx").on(table.clientId, table.bookingStart),
    spaceStartIndex: index("studio_bookings_space_start_idx").on(table.spaceId, table.bookingStart),
    statusStartIndex: index("studio_bookings_status_start_idx").on(table.status, table.bookingStart),
  }),
);

export const studioBookingEquipmentItems = pgTable(
  "studio_booking_equipment_items",
  {
    ...baseColumns,
    bookingId: uuid("booking_id").references(() => studioBookings.id).notNull(),
    equipmentId: uuid("equipment_id").references(() => studioEquipment.id).notNull(),
    quantity: integer("quantity").notNull().default(1),
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
    dailyRateCents: integer("daily_rate_cents").notNull().default(0),
  },
  (table) => ({
    bookingEquipmentIndex: index("studio_booking_equipment_items_booking_equipment_idx").on(table.bookingId, table.equipmentId),
    equipmentIndex: index("studio_booking_equipment_items_equipment_idx").on(table.equipmentId),
  }),
);

export const studioAccessAttempts = pgTable(
  "studio_access_attempts",
  {
    ...baseColumns,
    bookingId: uuid("booking_id").references(() => studioBookings.id),
    accessCode: varchar("access_code", { length: 6 }).notNull(),
    attemptedAt: timestamp("attempted_at", { withTimezone: true }).notNull(),
    valid: requiredBoolean("valid", false),
    sourceIp: text("source_ip"),
    userAgent: text("user_agent"),
    notes: text("notes"),
  },
  (table) => ({
    bookingAttemptedIndex: index("studio_access_attempts_booking_attempted_idx").on(table.bookingId, table.attemptedAt),
    codeAttemptedIndex: index("studio_access_attempts_code_attempted_idx").on(table.accessCode, table.attemptedAt),
  }),
);
