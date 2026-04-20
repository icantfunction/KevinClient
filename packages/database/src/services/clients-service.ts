// Stage 2 Clients Service Purpose
import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { clients, type AddressJson } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateClientInput = {
  readonly clientType: "photo" | "studio_renter" | "both";
  readonly primaryName: string;
  readonly partnerName?: string | null;
  readonly businessName?: string | null;
  readonly email?: string | null;
  readonly secondaryEmail?: string | null;
  readonly phone?: string | null;
  readonly mailingAddress?: AddressJson;
  readonly billingAddress?: AddressJson;
  readonly referralSource?: string | null;
  readonly howWeMet?: string | null;
  readonly lifetimeValueCents?: number;
  readonly firstBookedAt?: Date | null;
  readonly tags?: string[];
  readonly vip?: boolean;
  readonly blocked?: boolean;
  readonly notes?: string | null;
};

type ListedClientRow = {
  readonly id: string;
  readonly created_at: string | Date;
  readonly updated_at: string | Date;
  readonly deleted_at: string | Date | null;
  readonly version: number | string;
  readonly client_type: "photo" | "studio_renter" | "both";
  readonly primary_name: string;
  readonly partner_name: string | null;
  readonly business_name: string | null;
  readonly email: string | null;
  readonly secondary_email: string | null;
  readonly phone: string | null;
  readonly mailing_address_json: string | null;
  readonly billing_address_json: string | null;
  readonly referral_source: string | null;
  readonly how_we_met: string | null;
  readonly lifetime_value_cents: number | string;
  readonly first_booked_at: string | Date | null;
  readonly tags_json: string | null;
  readonly vip: boolean;
  readonly blocked: boolean;
  readonly notes: string | null;
};

const parseJsonObject = (value: string | null, fallback: AddressJson): AddressJson => {
  if (!value) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? (parsed as AddressJson) : fallback;
  } catch {
    return fallback;
  }
};

const parseJsonArray = (value: string | null): string[] => {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((entry): entry is string => typeof entry === "string") : [];
  } catch {
    return [];
  }
};

export class ClientsService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createClient(input: CreateClientInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const inserted = {
      id: createUuid(),
      clientType: input.clientType,
      primaryName: input.primaryName,
      partnerName: input.partnerName ?? null,
      businessName: input.businessName ?? null,
      email: input.email ?? null,
      secondaryEmail: input.secondaryEmail ?? null,
      phone: input.phone ?? null,
      mailingAddress: input.mailingAddress ?? {},
      billingAddress: input.billingAddress ?? {},
      referralSource: input.referralSource ?? null,
      howWeMet: input.howWeMet ?? null,
      lifetimeValueCents: input.lifetimeValueCents ?? 0,
      firstBookedAt: input.firstBookedAt ?? null,
      tags: input.tags ?? [],
      vip: input.vip ?? false,
      blocked: input.blocked ?? false,
      notes: input.notes ?? null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    await this.database.insert(clients).values(inserted);

    return this.recordMutation(context, {
      entityName: "client",
      eventName: "created",
      entityId: inserted.id,
      before: null,
      after: inserted,
      result: inserted,
    });
  }

  public async getClientById(id: string) {
    const records = await this.database
      .select()
      .from(clients)
      .where(and(eq(clients.id, id), isNull(clients.deletedAt)))
      .limit(1);

    return records[0] ?? null;
  }

  public async listClients(input: { readonly query?: string; readonly limit?: number } = {}) {
    const query = input.query?.trim().toLowerCase();
    const likePattern = query ? `%${query}%` : null;
    const limit = Math.min(input.limit ?? 100, 200);
    const result = await this.database.execute(sql`
      select
        id::text as id,
        created_at,
        updated_at,
        deleted_at,
        version,
        client_type,
        primary_name,
        partner_name,
        business_name,
        email,
        secondary_email,
        phone,
        mailing_address::text as mailing_address_json,
        billing_address::text as billing_address_json,
        referral_source,
        how_we_met,
        lifetime_value_cents,
        first_booked_at,
        coalesce(array_to_json(tags)::text, '[]') as tags_json,
        vip,
        blocked,
        notes
      from clients
      where deleted_at is null
        and (
          ${query === undefined}
          or lower(
            concat_ws(
              ' ',
              primary_name,
              partner_name,
              business_name,
              email,
              secondary_email,
              phone,
              referral_source,
              notes
            )
          ) like ${likePattern}
        )
      order by vip desc, lifetime_value_cents desc, primary_name asc
      limit ${sql.raw(String(limit))}
    `);

    return (result.rows as unknown as ListedClientRow[]).map((row) => ({
      id: row.id,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      deletedAt: row.deleted_at ? new Date(row.deleted_at) : null,
      version: Number(row.version),
      clientType: row.client_type,
      primaryName: row.primary_name,
      partnerName: row.partner_name,
      businessName: row.business_name,
      email: row.email,
      secondaryEmail: row.secondary_email,
      phone: row.phone,
      mailingAddress: parseJsonObject(row.mailing_address_json, {}),
      billingAddress: parseJsonObject(row.billing_address_json, {}),
      referralSource: row.referral_source,
      howWeMet: row.how_we_met,
      lifetimeValueCents: Number(row.lifetime_value_cents),
      firstBookedAt: row.first_booked_at ? new Date(row.first_booked_at) : null,
      tags: parseJsonArray(row.tags_json),
      vip: row.vip,
      blocked: row.blocked,
      notes: row.notes,
    }));
  }

  public async findClientByContact(email?: string | null, phone?: string | null) {
    const normalizedEmail = email?.trim().toLowerCase();
    const normalizedPhone = phone?.trim();

    if (!normalizedEmail && !normalizedPhone) {
      return null;
    }

    const contactMatch = or(
      normalizedEmail
        ? or(
            sql`lower(${clients.email}) = ${normalizedEmail}`,
            sql`lower(${clients.secondaryEmail}) = ${normalizedEmail}`,
          )
        : undefined,
      normalizedPhone ? eq(clients.phone, normalizedPhone) : undefined,
    );

    if (!contactMatch) {
      return null;
    }

    const records = await this.database
      .select()
      .from(clients)
      .where(and(isNull(clients.deletedAt), contactMatch))
      .limit(1);

    return records[0] ?? null;
  }
}
