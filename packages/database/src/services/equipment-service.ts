// Stage 7 Equipment Service Purpose
import { and, asc, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { studioEquipment } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateStudioEquipmentInput = {
  readonly name: string;
  readonly description?: string | null;
  readonly hourlyRateCents?: number;
  readonly dailyRateCents?: number;
  readonly replacementCostCents?: number;
  readonly quantityOwned?: number;
  readonly quantityAvailable?: number;
  readonly conditionNotes?: string | null;
  readonly lastServicedAt?: Date | null;
  readonly images?: string[];
  readonly active?: boolean;
};

export type UpdateStudioEquipmentInput = Partial<CreateStudioEquipmentInput>;

export class EquipmentService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createEquipment(input: CreateStudioEquipmentInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const quantityOwned = Math.max(input.quantityOwned ?? 0, 0);
    const quantityAvailable = Math.min(Math.max(input.quantityAvailable ?? quantityOwned, 0), quantityOwned);

    const inserted = {
      id: createUuid(),
      name: input.name,
      description: input.description ?? null,
      hourlyRateCents: Math.max(input.hourlyRateCents ?? 0, 0),
      dailyRateCents: Math.max(input.dailyRateCents ?? 0, 0),
      replacementCostCents: Math.max(input.replacementCostCents ?? 0, 0),
      quantityOwned,
      quantityAvailable,
      conditionNotes: input.conditionNotes ?? null,
      lastServicedAt: input.lastServicedAt ?? null,
      images: input.images ?? [],
      active: input.active ?? true,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    return this.persistMutation(context, async (database) => {
      await database.insert(studioEquipment).values(inserted);

      return {
        entityName: "studio_equipment",
        eventName: "created",
        entityId: inserted.id,
        before: null,
        after: inserted,
        result: inserted,
      };
    });
  }

  public async updateEquipment(id: string, input: UpdateStudioEquipmentInput, context: MutationContext) {
    const existing = await this.getEquipmentById(id);
    if (!existing) {
      throw new Error(`Studio equipment ${id} was not found.`);
    }

    const quantityOwned = input.quantityOwned !== undefined ? Math.max(input.quantityOwned, 0) : existing.quantityOwned;
    const requestedAvailable =
      input.quantityAvailable !== undefined ? Math.max(input.quantityAvailable, 0) : existing.quantityAvailable;

    const updated = {
      ...existing,
      name: input.name ?? existing.name,
      description: input.description !== undefined ? input.description : existing.description,
      hourlyRateCents: input.hourlyRateCents !== undefined ? Math.max(input.hourlyRateCents, 0) : existing.hourlyRateCents,
      dailyRateCents: input.dailyRateCents !== undefined ? Math.max(input.dailyRateCents, 0) : existing.dailyRateCents,
      replacementCostCents:
        input.replacementCostCents !== undefined ? Math.max(input.replacementCostCents, 0) : existing.replacementCostCents,
      quantityOwned,
      quantityAvailable: Math.min(requestedAvailable, quantityOwned),
      conditionNotes: input.conditionNotes !== undefined ? input.conditionNotes : existing.conditionNotes,
      lastServicedAt: input.lastServicedAt !== undefined ? input.lastServicedAt : existing.lastServicedAt,
      images: input.images ?? existing.images,
      active: input.active ?? existing.active,
      updatedAt: context.occurredAt ?? new Date(),
      version: existing.version + 1,
    };

    return this.persistMutation(context, async (database) => {
      await database
        .update(studioEquipment)
        .set({
          name: updated.name,
          description: updated.description,
          hourlyRateCents: updated.hourlyRateCents,
          dailyRateCents: updated.dailyRateCents,
          replacementCostCents: updated.replacementCostCents,
          quantityOwned: updated.quantityOwned,
          quantityAvailable: updated.quantityAvailable,
          conditionNotes: updated.conditionNotes,
          lastServicedAt: updated.lastServicedAt,
          images: updated.images,
          active: updated.active,
          updatedAt: updated.updatedAt,
          version: updated.version,
        })
        .where(eq(studioEquipment.id, id));

      return {
        entityName: "studio_equipment",
        eventName: "updated",
        entityId: id,
        before: existing,
        after: updated,
        result: updated,
      };
    });
  }

  public async getEquipmentById(id: string) {
    const rows = await this.database
      .select()
      .from(studioEquipment)
      .where(and(eq(studioEquipment.id, id), isNull(studioEquipment.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }

  public async listEquipment(input: { readonly activeOnly?: boolean } = {}) {
    return this.database
      .select()
      .from(studioEquipment)
      .where(and(isNull(studioEquipment.deletedAt), input.activeOnly ? eq(studioEquipment.active, true) : undefined))
      .orderBy(asc(studioEquipment.name));
  }
}
