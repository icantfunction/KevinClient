// Stage 7 Spaces Service Purpose
import { and, asc, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { studioSpaces, type StudioAvailabilityRules } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateStudioSpaceInput = {
  readonly name: string;
  readonly description?: string | null;
  readonly capacity?: number;
  readonly hourlyRateCents?: number;
  readonly halfDayRateCents?: number;
  readonly fullDayRateCents?: number;
  readonly minBookingHours?: number;
  readonly bufferMinutes?: number;
  readonly amenities?: string[];
  readonly includedEquipment?: string[];
  readonly houseRules?: string | null;
  readonly coverImageS3Key?: string | null;
  readonly galleryImageS3Keys?: string[];
  readonly availabilityRules?: StudioAvailabilityRules;
  readonly active?: boolean;
};

export type UpdateStudioSpaceInput = Partial<CreateStudioSpaceInput>;

export class SpacesService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createSpace(input: CreateStudioSpaceInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const inserted = {
      id: createUuid(),
      name: input.name,
      description: input.description ?? null,
      capacity: Math.max(input.capacity ?? 1, 1),
      hourlyRateCents: Math.max(input.hourlyRateCents ?? 0, 0),
      halfDayRateCents: Math.max(input.halfDayRateCents ?? 0, 0),
      fullDayRateCents: Math.max(input.fullDayRateCents ?? 0, 0),
      minBookingHours: Math.max(input.minBookingHours ?? 1, 1),
      bufferMinutes: Math.max(input.bufferMinutes ?? 0, 0),
      amenities: input.amenities ?? [],
      includedEquipment: input.includedEquipment ?? [],
      houseRules: input.houseRules ?? null,
      coverImageS3Key: input.coverImageS3Key ?? null,
      galleryImageS3Keys: input.galleryImageS3Keys ?? [],
      availabilityRules: input.availabilityRules ?? {},
      active: input.active ?? true,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    return this.persistMutation(context, async (database) => {
      await database.insert(studioSpaces).values(inserted);

      return {
        entityName: "studio_space",
        eventName: "created",
        entityId: inserted.id,
        before: null,
        after: inserted,
        result: inserted,
      };
    });
  }

  public async updateSpace(id: string, input: UpdateStudioSpaceInput, context: MutationContext) {
    const existing = await this.getSpaceById(id);
    if (!existing) {
      throw new Error(`Studio space ${id} was not found.`);
    }

    const updated = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description ?? existing.description,
      capacity: input.capacity !== undefined ? Math.max(input.capacity, 1) : existing.capacity,
      hourlyRateCents: input.hourlyRateCents !== undefined ? Math.max(input.hourlyRateCents, 0) : existing.hourlyRateCents,
      halfDayRateCents:
        input.halfDayRateCents !== undefined ? Math.max(input.halfDayRateCents, 0) : existing.halfDayRateCents,
      fullDayRateCents:
        input.fullDayRateCents !== undefined ? Math.max(input.fullDayRateCents, 0) : existing.fullDayRateCents,
      minBookingHours:
        input.minBookingHours !== undefined ? Math.max(input.minBookingHours, 1) : existing.minBookingHours,
      bufferMinutes: input.bufferMinutes !== undefined ? Math.max(input.bufferMinutes, 0) : existing.bufferMinutes,
      amenities: input.amenities ?? existing.amenities,
      includedEquipment: input.includedEquipment ?? existing.includedEquipment,
      houseRules: input.houseRules !== undefined ? input.houseRules : existing.houseRules,
      coverImageS3Key: input.coverImageS3Key !== undefined ? input.coverImageS3Key : existing.coverImageS3Key,
      galleryImageS3Keys: input.galleryImageS3Keys ?? existing.galleryImageS3Keys,
      availabilityRules: input.availabilityRules ?? existing.availabilityRules,
      active: input.active ?? existing.active,
      updatedAt: context.occurredAt ?? new Date(),
      version: existing.version + 1,
    };

    return this.persistMutation(context, async (database) => {
      await database
        .update(studioSpaces)
        .set({
          name: updated.name,
          description: updated.description,
          capacity: updated.capacity,
          hourlyRateCents: updated.hourlyRateCents,
          halfDayRateCents: updated.halfDayRateCents,
          fullDayRateCents: updated.fullDayRateCents,
          minBookingHours: updated.minBookingHours,
          bufferMinutes: updated.bufferMinutes,
          amenities: updated.amenities,
          includedEquipment: updated.includedEquipment,
          houseRules: updated.houseRules,
          coverImageS3Key: updated.coverImageS3Key,
          galleryImageS3Keys: updated.galleryImageS3Keys,
          availabilityRules: updated.availabilityRules,
          active: updated.active,
          updatedAt: updated.updatedAt,
          version: updated.version,
        })
        .where(eq(studioSpaces.id, id));

      return {
        entityName: "studio_space",
        eventName: "updated",
        entityId: id,
        before: existing,
        after: updated,
        result: updated,
      };
    });
  }

  public async getSpaceById(id: string) {
    const rows = await this.database
      .select()
      .from(studioSpaces)
      .where(and(eq(studioSpaces.id, id), isNull(studioSpaces.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }

  public async listSpaces(input: { readonly activeOnly?: boolean } = {}) {
    return this.database
      .select()
      .from(studioSpaces)
      .where(and(isNull(studioSpaces.deletedAt), input.activeOnly ? eq(studioSpaces.active, true) : undefined))
      .orderBy(asc(studioSpaces.name));
  }
}
