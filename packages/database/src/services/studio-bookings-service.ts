// Stage 7 Studio Bookings Service Purpose
import { randomInt } from "node:crypto";
import {
  BeginTransactionCommand,
  CommitTransactionCommand,
  ExecuteStatementCommand,
  RollbackTransactionCommand,
  type SqlParameter,
} from "@aws-sdk/client-rds-data";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { createRawRdsDataClient, type StudioOsDatabase } from "../client";
import { resolveDatabaseRuntimeConfig } from "../config";
import {
  studioAccessAttempts,
  studioBookings,
  type StudioBookingEquipmentItemInput,
  type StudioBookingStatus,
} from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateStudioBookingInput = {
  readonly clientId: string;
  readonly spaceId: string;
  readonly status?: StudioBookingStatus;
  readonly bookingStart: Date;
  readonly bookingEnd: Date;
  readonly equipmentItems?: StudioBookingEquipmentItemInput[];
  readonly partySize?: number | null;
  readonly purpose?: string | null;
  readonly needsCleanupCrew?: boolean;
  readonly needsLightingAssist?: boolean;
  readonly pricingBreakdown?: Record<string, unknown>;
  readonly depositAmountCents?: number;
  readonly depositPaid?: boolean;
  readonly balanceDueAt?: Date | null;
  readonly balancePaid?: boolean;
  readonly liabilityWaiverId?: string | null;
  readonly checkinAt?: Date | null;
  readonly checkoutAt?: Date | null;
  readonly damageNoted?: boolean;
  readonly damageNotes?: string | null;
  readonly damageChargeCents?: number;
  readonly reviewRating?: number | null;
  readonly reviewText?: string | null;
  readonly holdExpiresAt?: Date | null;
  readonly notes?: string | null;
};

export type UpdateStudioBookingInput = Partial<CreateStudioBookingInput>;

export type StudioCalendarEntry = {
  readonly entryType: "studio_booking" | "studio_buffer" | "session_block";
  readonly id: string;
  readonly title: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly status: string | null;
  readonly color: string;
  readonly spaceId: string | null;
};

export type StudioBookingEquipmentItemRecord = {
  readonly id: string;
  readonly equipmentId: string;
  readonly equipmentName: string;
  readonly quantity: number;
  readonly hourlyRateCents: number;
  readonly dailyRateCents: number;
};

export type StudioBookingRecord = typeof studioBookings.$inferSelect & {
  readonly equipmentItems: StudioBookingEquipmentItemRecord[];
};

type RawStudioCalendarEntry = {
  readonly entry_type: "studio_booking" | "studio_buffer" | "session_block";
  readonly id: string;
  readonly title: string;
  readonly starts_at: string | Date;
  readonly ends_at: string | Date;
  readonly status: string | null;
  readonly color: string;
  readonly space_id: string | null;
};

const nullParam = (name: string): SqlParameter => ({
  name,
  value: {
    isNull: true,
  },
});

const stringParam = (name: string, value?: string | null): SqlParameter =>
  value == null
    ? nullParam(name)
    : {
        name,
        value: {
          stringValue: value,
        },
      };

const longParam = (name: string, value?: number | null): SqlParameter =>
  value == null
    ? nullParam(name)
    : {
        name,
        value: {
          longValue: Math.trunc(value),
        },
      };

const booleanParam = (name: string, value?: boolean | null): SqlParameter =>
  value == null
    ? nullParam(name)
    : {
        name,
        value: {
          booleanValue: value,
        },
      };

const jsonParam = (name: string, value?: Record<string, unknown> | null): SqlParameter =>
  value == null
    ? nullParam(name)
    : {
        name,
        value: {
          stringValue: JSON.stringify(value),
        },
        typeHint: "JSON",
      };

const normalizeEquipmentItems = (items: StudioBookingEquipmentItemInput[] | undefined) =>
  (items ?? [])
    .filter((item) => Boolean(item.equipmentId))
    .map((item) => ({
      equipmentId: item.equipmentId,
      quantity: Math.max(1, Math.trunc(item.quantity)),
    }));

const createAccessWindow = (bookingStart: Date, bookingEnd: Date, existingCode?: string | null) => ({
  accessCode: existingCode ?? `${randomInt(0, 1_000_000)}`.padStart(6, "0"),
  accessValidFrom: new Date(bookingStart.getTime() - 30 * 60 * 1000),
  accessValidUntil: new Date(bookingEnd.getTime() + 30 * 60 * 1000),
});

export class StudioBookingsService extends BaseDomainService {
  private readonly rdsClient = createRawRdsDataClient();

  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createBooking(input: CreateStudioBookingInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const bookingId = createUuid();
    const normalized = this.normalizeCreateInput(input, occurredAt);

    await this.withSerializableTransaction(async (transactionId) => {
      await this.assertStudioSessionAvailability(normalized.bookingStart, normalized.bookingEnd, transactionId);
      await this.assertEquipmentAvailability(normalized.equipmentItems, transactionId);

      await this.executeStatement(
        `
          insert into studio_bookings (
            id, client_id, space_id, status, booking_start, booking_end, party_size, purpose,
            needs_cleanup_crew, needs_lighting_assist, pricing_breakdown, deposit_amount_cents,
            deposit_paid, balance_due_at, balance_paid, liability_waiver_id, access_code,
            access_valid_from, access_valid_until, checkin_at, checkout_at, damage_noted, damage_notes, damage_charge_cents,
            review_rating, review_text, hold_expires_at, notes, created_at, updated_at, deleted_at, version
          )
          values (
            cast(:id as uuid), cast(:client_id as uuid), cast(:space_id as uuid), :status,
            cast(:booking_start as timestamptz), cast(:booking_end as timestamptz), :party_size, :purpose,
            :needs_cleanup_crew, :needs_lighting_assist, cast(:pricing_breakdown as jsonb), :deposit_amount_cents,
            :deposit_paid, cast(:balance_due_at as timestamptz), :balance_paid, cast(:liability_waiver_id as uuid), :access_code,
            cast(:access_valid_from as timestamptz), cast(:access_valid_until as timestamptz), cast(:checkin_at as timestamptz), cast(:checkout_at as timestamptz), :damage_noted, :damage_notes, :damage_charge_cents,
            :review_rating, :review_text, cast(:hold_expires_at as timestamptz), :notes, cast(:created_at as timestamptz),
            cast(:updated_at as timestamptz), null, 1
          )
        `,
        [
          stringParam("id", bookingId),
          stringParam("client_id", normalized.clientId),
          stringParam("space_id", normalized.spaceId),
          stringParam("status", normalized.status),
          stringParam("booking_start", normalized.bookingStart.toISOString()),
          stringParam("booking_end", normalized.bookingEnd.toISOString()),
          longParam("party_size", normalized.partySize),
          stringParam("purpose", normalized.purpose),
          booleanParam("needs_cleanup_crew", normalized.needsCleanupCrew),
          booleanParam("needs_lighting_assist", normalized.needsLightingAssist),
          jsonParam("pricing_breakdown", normalized.pricingBreakdown),
          longParam("deposit_amount_cents", normalized.depositAmountCents),
          booleanParam("deposit_paid", normalized.depositPaid),
          stringParam("balance_due_at", normalized.balanceDueAt?.toISOString() ?? null),
          booleanParam("balance_paid", normalized.balancePaid),
          stringParam("liability_waiver_id", normalized.liabilityWaiverId),
          stringParam("access_code", normalized.accessCode),
          stringParam("access_valid_from", normalized.accessValidFrom?.toISOString() ?? null),
          stringParam("access_valid_until", normalized.accessValidUntil?.toISOString() ?? null),
          stringParam("checkin_at", normalized.checkinAt?.toISOString() ?? null),
          stringParam("checkout_at", normalized.checkoutAt?.toISOString() ?? null),
          booleanParam("damage_noted", normalized.damageNoted),
          stringParam("damage_notes", normalized.damageNotes),
          longParam("damage_charge_cents", normalized.damageChargeCents),
          longParam("review_rating", normalized.reviewRating),
          stringParam("review_text", normalized.reviewText),
          stringParam("hold_expires_at", normalized.holdExpiresAt?.toISOString() ?? null),
          stringParam("notes", normalized.notes),
          stringParam("created_at", occurredAt.toISOString()),
          stringParam("updated_at", occurredAt.toISOString()),
        ],
        transactionId,
      );

      await this.replaceEquipmentItems(bookingId, normalized.equipmentItems, occurredAt, transactionId);
    });

    const booking = await this.getBookingById(bookingId);
    if (!booking) {
      throw new Error(`Studio booking ${bookingId} was not found after creation.`);
    }

    return this.recordMutation(context, {
      entityName: "studio_booking",
      eventName: "created",
      entityId: bookingId,
      before: null,
      after: booking,
      result: booking,
    });
  }

  public async updateBooking(id: string, input: UpdateStudioBookingInput, context: MutationContext) {
    const existing = await this.getBookingById(id);
    if (!existing) {
      throw new Error(`Studio booking ${id} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const normalized = this.normalizeUpdateInput(existing, input, occurredAt);

    await this.withSerializableTransaction(async (transactionId) => {
      await this.assertStudioSessionAvailability(normalized.bookingStart, normalized.bookingEnd, transactionId, id);
      await this.assertEquipmentAvailability(normalized.equipmentItems, transactionId);

      await this.executeStatement(
        `
          update studio_bookings
          set
            client_id = cast(:client_id as uuid),
            space_id = cast(:space_id as uuid),
            status = :status,
            booking_start = cast(:booking_start as timestamptz),
            booking_end = cast(:booking_end as timestamptz),
            party_size = :party_size,
            purpose = :purpose,
            needs_cleanup_crew = :needs_cleanup_crew,
            needs_lighting_assist = :needs_lighting_assist,
            pricing_breakdown = cast(:pricing_breakdown as jsonb),
            deposit_amount_cents = :deposit_amount_cents,
            deposit_paid = :deposit_paid,
            balance_due_at = cast(:balance_due_at as timestamptz),
            balance_paid = :balance_paid,
            liability_waiver_id = cast(:liability_waiver_id as uuid),
            access_code = :access_code,
            access_valid_from = cast(:access_valid_from as timestamptz),
            access_valid_until = cast(:access_valid_until as timestamptz),
            checkin_at = cast(:checkin_at as timestamptz),
            checkout_at = cast(:checkout_at as timestamptz),
            damage_noted = :damage_noted,
            damage_notes = :damage_notes,
            damage_charge_cents = :damage_charge_cents,
            review_rating = :review_rating,
            review_text = :review_text,
            hold_expires_at = cast(:hold_expires_at as timestamptz),
            notes = :notes,
            updated_at = cast(:updated_at as timestamptz),
            version = version + 1
          where id = cast(:id as uuid)
            and deleted_at is null
        `,
        [
          stringParam("id", id),
          stringParam("client_id", normalized.clientId),
          stringParam("space_id", normalized.spaceId),
          stringParam("status", normalized.status),
          stringParam("booking_start", normalized.bookingStart.toISOString()),
          stringParam("booking_end", normalized.bookingEnd.toISOString()),
          longParam("party_size", normalized.partySize),
          stringParam("purpose", normalized.purpose),
          booleanParam("needs_cleanup_crew", normalized.needsCleanupCrew),
          booleanParam("needs_lighting_assist", normalized.needsLightingAssist),
          jsonParam("pricing_breakdown", normalized.pricingBreakdown),
          longParam("deposit_amount_cents", normalized.depositAmountCents),
          booleanParam("deposit_paid", normalized.depositPaid),
          stringParam("balance_due_at", normalized.balanceDueAt?.toISOString() ?? null),
          booleanParam("balance_paid", normalized.balancePaid),
          stringParam("liability_waiver_id", normalized.liabilityWaiverId),
          stringParam("access_code", normalized.accessCode),
          stringParam("access_valid_from", normalized.accessValidFrom?.toISOString() ?? null),
          stringParam("access_valid_until", normalized.accessValidUntil?.toISOString() ?? null),
          stringParam("checkin_at", normalized.checkinAt?.toISOString() ?? null),
          stringParam("checkout_at", normalized.checkoutAt?.toISOString() ?? null),
          booleanParam("damage_noted", normalized.damageNoted),
          stringParam("damage_notes", normalized.damageNotes),
          longParam("damage_charge_cents", normalized.damageChargeCents),
          longParam("review_rating", normalized.reviewRating),
          stringParam("review_text", normalized.reviewText),
          stringParam("hold_expires_at", normalized.holdExpiresAt?.toISOString() ?? null),
          stringParam("notes", normalized.notes),
          stringParam("updated_at", occurredAt.toISOString()),
        ],
        transactionId,
      );

      if (input.equipmentItems) {
        await this.executeStatement(
          `
            update studio_booking_equipment_items
            set
              deleted_at = cast(:deleted_at as timestamptz),
              updated_at = cast(:updated_at as timestamptz),
              version = version + 1
            where booking_id = cast(:booking_id as uuid)
              and deleted_at is null
          `,
          [
            stringParam("booking_id", id),
            stringParam("deleted_at", occurredAt.toISOString()),
            stringParam("updated_at", occurredAt.toISOString()),
          ],
          transactionId,
        );

        await this.replaceEquipmentItems(id, normalized.equipmentItems, occurredAt, transactionId);
      }
    });

    const updated = await this.getBookingById(id);
    if (!updated) {
      throw new Error(`Studio booking ${id} was not found after update.`);
    }

    return this.recordMutation(context, {
      entityName: "studio_booking",
      eventName: "updated",
      entityId: id,
      before: existing,
      after: updated,
      result: updated,
    });
  }

  public async getBookingById(id: string): Promise<StudioBookingRecord | null> {
    const rows = await this.database
      .select()
      .from(studioBookings)
      .where(and(eq(studioBookings.id, id), isNull(studioBookings.deletedAt)))
      .limit(1);

    const booking = rows[0];
    if (!booking) {
      return null;
    }

    return {
      ...booking,
      equipmentItems: await this.listBookingEquipmentItems(id),
    };
  }

  public async listBookings(input: {
    readonly status?: StudioBookingStatus;
    readonly spaceId?: string;
    readonly clientId?: string;
    readonly from?: Date;
    readonly to?: Date;
  } = {}) {
    return this.database
      .select()
      .from(studioBookings)
      .where(
        and(
          isNull(studioBookings.deletedAt),
          input.status ? eq(studioBookings.status, input.status) : undefined,
          input.spaceId ? eq(studioBookings.spaceId, input.spaceId) : undefined,
          input.clientId ? eq(studioBookings.clientId, input.clientId) : undefined,
          input.from ? sql`${studioBookings.bookingStart} >= cast(${input.from.toISOString()} as timestamptz)` : undefined,
          input.to ? sql`${studioBookings.bookingStart} <= cast(${input.to.toISOString()} as timestamptz)` : undefined,
        ),
      )
      .orderBy(desc(studioBookings.bookingStart));
  }

  public async listStudioCalendarEntries(from: Date, to: Date, spaceId?: string): Promise<StudioCalendarEntry[]> {
    const result = await this.database.execute(sql`
      with booking_entries as (
        select
          'studio_booking'::text as entry_type,
          booking.id::text as id,
          concat(space.name, ' booking')::text as title,
          booking.booking_start as starts_at,
          booking.booking_end as ends_at,
          booking.status::text as status,
          case
            when booking.status = 'hold' then '#d97706'
            when booking.status = 'confirmed' then '#2563eb'
            when booking.status = 'in_use' then '#7c3aed'
            when booking.status = 'completed' then '#4b5563'
            else '#475569'
          end::text as color,
          booking.space_id::text as space_id
        from studio_bookings booking
        join studio_spaces space on space.id = booking.space_id
        where booking.deleted_at is null
          and booking.booking_start < ${sql`${to}::timestamptz`}
          and booking.booking_end > ${sql`${from}::timestamptz`}
          and (${spaceId ?? null}::uuid is null or booking.space_id = ${sql`${spaceId ?? null}::uuid`})
      ),
      buffer_entries as (
        select
          'studio_buffer'::text as entry_type,
          concat(booking.id::text, ':buffer')::text as id,
          concat(space.name, ' turnover')::text as title,
          booking.booking_end as starts_at,
          booking.booking_end + make_interval(mins => greatest(space.buffer_minutes, 0)) as ends_at,
          booking.status::text as status,
          '#ef4444'::text as color,
          booking.space_id::text as space_id
        from studio_bookings booking
        join studio_spaces space on space.id = booking.space_id
        where booking.deleted_at is null
          and booking.status in ('confirmed', 'in_use', 'completed')
          and space.buffer_minutes > 0
          and booking.booking_end < ${sql`${to}::timestamptz`}
          and booking.booking_end + make_interval(mins => greatest(space.buffer_minutes, 0)) > ${sql`${from}::timestamptz`}
          and (${spaceId ?? null}::uuid is null or booking.space_id = ${sql`${spaceId ?? null}::uuid`})
      ),
      session_block_entries as (
        select
          'session_block'::text as entry_type,
          session.id::text as id,
          concat('Kevin session: ', session.title)::text as title,
          session.scheduled_start as starts_at,
          session.scheduled_end as ends_at,
          session.status::text as status,
          '#0f766e'::text as color,
          null::text as space_id
        from sessions session
        where session.deleted_at is null
          and session.uses_own_studio = true
          and session.scheduled_start is not null
          and session.scheduled_end is not null
          and session.scheduled_start < ${sql`${to}::timestamptz`}
          and session.scheduled_end > ${sql`${from}::timestamptz`}
      )
      select * from booking_entries
      union all
      select * from buffer_entries
      union all
      select * from session_block_entries
      order by starts_at asc
    `);

    return (result.rows as unknown as RawStudioCalendarEntry[]).map((row) => ({
      entryType: row.entry_type,
      id: row.id,
      title: row.title,
      startsAt: new Date(row.starts_at),
      endsAt: new Date(row.ends_at),
      status: row.status,
      color: row.color,
      spaceId: row.space_id,
    }));
  }

  public async verifyAccessCode(
    input: {
      readonly accessCode: string;
      readonly attemptedAt?: Date;
      readonly sourceIp?: string | null;
      readonly userAgent?: string | null;
    },
    context: MutationContext,
  ) {
    const attemptedAt = input.attemptedAt ?? context.occurredAt ?? new Date();
    const result = await this.database.execute(sql`
      select id::text as id
      from studio_bookings
      where deleted_at is null
        and access_code = ${input.accessCode}
        and status in ('confirmed', 'in_use')
        and access_valid_from is not null
        and access_valid_until is not null
        and ${sql`${attemptedAt}::timestamptz`} between access_valid_from and access_valid_until
      order by booking_start asc
      limit 1
    `);

    const bookingId = (result.rows[0] as { id?: string } | undefined)?.id ?? null;
    const accessAttempt = {
      id: createUuid(),
      bookingId,
      accessCode: input.accessCode,
      attemptedAt,
      valid: Boolean(bookingId),
      sourceIp: input.sourceIp ?? null,
      userAgent: input.userAgent ?? null,
      notes: null,
      createdAt: attemptedAt,
      updatedAt: attemptedAt,
      deletedAt: null,
      version: 1,
    };

    await this.database.insert(studioAccessAttempts).values(accessAttempt);

    await this.recordMutation(context, {
      entityName: "studio_access_attempt",
      eventName: "created",
      entityId: accessAttempt.id,
      before: null,
      after: accessAttempt,
      result: accessAttempt,
    });

    return {
      valid: Boolean(bookingId),
      bookingId,
    };
  }

  private normalizeCreateInput(input: CreateStudioBookingInput, occurredAt: Date) {
    const status = input.status ?? "inquiry";
    const equipmentItems = normalizeEquipmentItems(input.equipmentItems);
    const normalized = {
      clientId: input.clientId,
      spaceId: input.spaceId,
      status,
      bookingStart: input.bookingStart,
      bookingEnd: input.bookingEnd,
      equipmentItems,
      partySize: input.partySize ?? null,
      purpose: input.purpose ?? null,
      needsCleanupCrew: input.needsCleanupCrew ?? false,
      needsLightingAssist: input.needsLightingAssist ?? false,
      pricingBreakdown: input.pricingBreakdown ?? {},
      depositAmountCents: Math.max(input.depositAmountCents ?? 0, 0),
      depositPaid: input.depositPaid ?? false,
      balanceDueAt: input.balanceDueAt ?? null,
      balancePaid: input.balancePaid ?? false,
      liabilityWaiverId: input.liabilityWaiverId ?? null,
      checkinAt: input.checkinAt ?? null,
      checkoutAt: input.checkoutAt ?? null,
      damageNoted: input.damageNoted ?? false,
      damageNotes: input.damageNotes ?? null,
      damageChargeCents: Math.max(input.damageChargeCents ?? 0, 0),
      reviewRating: input.reviewRating ?? null,
      reviewText: input.reviewText ?? null,
      holdExpiresAt: status === "hold" ? (input.holdExpiresAt ?? new Date(occurredAt.getTime() + 48 * 60 * 60 * 1000)) : null,
      notes: input.notes ?? null,
      accessCode: null as string | null,
      accessValidFrom: null as Date | null,
      accessValidUntil: null as Date | null,
    };

    if (status === "confirmed" && normalized.depositPaid) {
      const access = createAccessWindow(normalized.bookingStart, normalized.bookingEnd);
      normalized.accessCode = access.accessCode;
      normalized.accessValidFrom = access.accessValidFrom;
      normalized.accessValidUntil = access.accessValidUntil;
    }

    return normalized;
  }

  private normalizeUpdateInput(existing: StudioBookingRecord, input: UpdateStudioBookingInput, occurredAt: Date) {
    const equipmentItems = input.equipmentItems
      ? normalizeEquipmentItems(input.equipmentItems)
      : existing.equipmentItems.map((item) => ({
          equipmentId: item.equipmentId,
          quantity: item.quantity,
        }));

    const normalized = {
      clientId: input.clientId ?? existing.clientId,
      spaceId: input.spaceId ?? existing.spaceId,
      status: input.status ?? existing.status,
      bookingStart: input.bookingStart ?? existing.bookingStart,
      bookingEnd: input.bookingEnd ?? existing.bookingEnd,
      equipmentItems,
      partySize: input.partySize !== undefined ? input.partySize : existing.partySize,
      purpose: input.purpose !== undefined ? input.purpose : existing.purpose,
      needsCleanupCrew: input.needsCleanupCrew ?? existing.needsCleanupCrew,
      needsLightingAssist: input.needsLightingAssist ?? existing.needsLightingAssist,
      pricingBreakdown: input.pricingBreakdown ?? (existing.pricingBreakdown as Record<string, unknown>),
      depositAmountCents: input.depositAmountCents !== undefined ? Math.max(input.depositAmountCents, 0) : existing.depositAmountCents,
      depositPaid: input.depositPaid ?? existing.depositPaid,
      balanceDueAt: input.balanceDueAt !== undefined ? input.balanceDueAt : existing.balanceDueAt,
      balancePaid: input.balancePaid ?? existing.balancePaid,
      liabilityWaiverId: input.liabilityWaiverId !== undefined ? input.liabilityWaiverId : existing.liabilityWaiverId,
      checkinAt: input.checkinAt !== undefined ? input.checkinAt : existing.checkinAt,
      checkoutAt: input.checkoutAt !== undefined ? input.checkoutAt : existing.checkoutAt,
      damageNoted: input.damageNoted ?? existing.damageNoted,
      damageNotes: input.damageNotes !== undefined ? input.damageNotes : existing.damageNotes,
      damageChargeCents:
        input.damageChargeCents !== undefined ? Math.max(input.damageChargeCents, 0) : existing.damageChargeCents,
      reviewRating: input.reviewRating !== undefined ? input.reviewRating : existing.reviewRating,
      reviewText: input.reviewText !== undefined ? input.reviewText : existing.reviewText,
      holdExpiresAt:
        (input.status ?? existing.status) === "hold"
          ? (input.holdExpiresAt ?? existing.holdExpiresAt ?? new Date(occurredAt.getTime() + 48 * 60 * 60 * 1000))
          : null,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      accessCode: existing.accessCode,
      accessValidFrom: existing.accessValidFrom,
      accessValidUntil: existing.accessValidUntil,
    };

    if (normalized.status === "confirmed" && normalized.depositPaid) {
      const access = createAccessWindow(normalized.bookingStart, normalized.bookingEnd, existing.accessCode);
      normalized.accessCode = access.accessCode;
      normalized.accessValidFrom = access.accessValidFrom;
      normalized.accessValidUntil = access.accessValidUntil;
    } else {
      normalized.accessCode = null;
      normalized.accessValidFrom = null;
      normalized.accessValidUntil = null;
    }

    return normalized;
  }

  private async listBookingEquipmentItems(bookingId: string): Promise<StudioBookingEquipmentItemRecord[]> {
    const result = await this.database.execute(sql`
      select
        item.id::text as id,
        item.equipment_id::text as equipment_id,
        equipment.name::text as equipment_name,
        item.quantity::int as quantity,
        item.hourly_rate_cents::int as hourly_rate_cents,
        item.daily_rate_cents::int as daily_rate_cents
      from studio_booking_equipment_items item
      join studio_equipment equipment on equipment.id = item.equipment_id
      where item.deleted_at is null
        and item.booking_id = ${sql`${bookingId}::uuid`}
      order by equipment.name asc
    `);

    return (result.rows as unknown as Array<{
      readonly id: string;
      readonly equipment_id: string;
      readonly equipment_name: string;
      readonly quantity: number;
      readonly hourly_rate_cents: number;
      readonly daily_rate_cents: number;
    }>).map((row) => ({
      id: row.id,
      equipmentId: row.equipment_id,
      equipmentName: row.equipment_name,
      quantity: row.quantity,
      hourlyRateCents: row.hourly_rate_cents,
      dailyRateCents: row.daily_rate_cents,
    }));
  }

  private async withSerializableTransaction<T>(operation: (transactionId: string) => Promise<T>) {
    const runtime = resolveDatabaseRuntimeConfig();
    const begin = await this.rdsClient.send(
      new BeginTransactionCommand({
        resourceArn: runtime.resourceArn,
        secretArn: runtime.secretArn,
        database: runtime.databaseName,
      }),
    );

    const transactionId = begin.transactionId;
    if (!transactionId) {
      throw new Error("Failed to begin studio booking transaction.");
    }

    try {
      await this.executeStatement("set transaction isolation level serializable", [], transactionId);
      const result = await operation(transactionId);
      await this.rdsClient.send(
        new CommitTransactionCommand({
          resourceArn: runtime.resourceArn,
          secretArn: runtime.secretArn,
          transactionId,
        }),
      );
      return result;
    } catch (error) {
      await this.rdsClient.send(
        new RollbackTransactionCommand({
          resourceArn: runtime.resourceArn,
          secretArn: runtime.secretArn,
          transactionId,
        }),
      );
      throw error;
    }
  }

  private async executeStatement(statement: string, parameters: SqlParameter[], transactionId?: string) {
    const runtime = resolveDatabaseRuntimeConfig();
    return this.rdsClient.send(
      new ExecuteStatementCommand({
        resourceArn: runtime.resourceArn,
        secretArn: runtime.secretArn,
        database: runtime.databaseName,
        sql: statement,
        parameters,
        transactionId,
      }),
    );
  }

  private async assertStudioSessionAvailability(
    bookingStart: Date,
    bookingEnd: Date,
    transactionId: string,
    excludeBookingId?: string,
  ) {
    const overlap = await this.executeStatement(
      `
        select id
        from sessions
        where deleted_at is null
          and uses_own_studio = true
          and scheduled_start is not null
          and scheduled_end is not null
          and tstzrange(scheduled_start, scheduled_end, '[)') && tstzrange(cast(:booking_start as timestamptz), cast(:booking_end as timestamptz), '[)')
        limit 1
      `,
      [
        stringParam("booking_start", bookingStart.toISOString()),
        stringParam("booking_end", bookingEnd.toISOString()),
        stringParam("exclude_booking_id", excludeBookingId ?? null),
      ],
      transactionId,
    );

    if ((overlap.records?.length ?? 0) > 0) {
      throw new Error("Requested booking conflicts with one of Kevin's own studio sessions.");
    }
  }

  private async assertEquipmentAvailability(items: ReturnType<typeof normalizeEquipmentItems>, transactionId: string) {
    for (const item of items) {
      const result = await this.executeStatement(
        `
          select quantity_available, active
          from studio_equipment
          where id = cast(:equipment_id as uuid)
            and deleted_at is null
          limit 1
        `,
        [stringParam("equipment_id", item.equipmentId)],
        transactionId,
      );

      const row = result.records?.[0];
      const quantityAvailable = row?.[0]?.longValue ?? 0;
      const active = row?.[1]?.booleanValue ?? false;
      if (!row || !active) {
        throw new Error(`Equipment ${item.equipmentId} is not available.`);
      }

      if (quantityAvailable < item.quantity) {
        throw new Error(`Equipment ${item.equipmentId} only has ${quantityAvailable} available units.`);
      }
    }
  }

  private async replaceEquipmentItems(
    bookingId: string,
    items: ReturnType<typeof normalizeEquipmentItems>,
    occurredAt: Date,
    transactionId: string,
  ) {
    for (const item of items) {
      const equipmentRates = await this.executeStatement(
        `
          select hourly_rate_cents, daily_rate_cents
          from studio_equipment
          where id = cast(:equipment_id as uuid)
            and deleted_at is null
          limit 1
        `,
        [stringParam("equipment_id", item.equipmentId)],
        transactionId,
      );

      const ratesRow = equipmentRates.records?.[0];
      if (!ratesRow) {
        throw new Error(`Equipment ${item.equipmentId} was not found.`);
      }

      await this.executeStatement(
        `
          insert into studio_booking_equipment_items (
            id, booking_id, equipment_id, quantity, hourly_rate_cents, daily_rate_cents,
            created_at, updated_at, deleted_at, version
          )
          values (
            cast(:id as uuid), cast(:booking_id as uuid), cast(:equipment_id as uuid), :quantity,
            :hourly_rate_cents, :daily_rate_cents, cast(:created_at as timestamptz), cast(:updated_at as timestamptz), null, 1
          )
        `,
        [
          stringParam("id", createUuid()),
          stringParam("booking_id", bookingId),
          stringParam("equipment_id", item.equipmentId),
          longParam("quantity", item.quantity),
          longParam("hourly_rate_cents", ratesRow[0]?.longValue ?? 0),
          longParam("daily_rate_cents", ratesRow[1]?.longValue ?? 0),
          stringParam("created_at", occurredAt.toISOString()),
          stringParam("updated_at", occurredAt.toISOString()),
        ],
        transactionId,
      );
    }
  }
}
