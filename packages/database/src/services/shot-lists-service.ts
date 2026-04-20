// Stage 4 Shot Lists Service Purpose
import { and, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { shotLists, type ShotListItem } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type UpsertShotListInput = {
  readonly sessionId: string;
  readonly items: ShotListItem[];
  readonly notes?: string | null;
};

export class ShotListsService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async getBySessionId(sessionId: string) {
    const records = await this.database
      .select()
      .from(shotLists)
      .where(and(eq(shotLists.sessionId, sessionId), isNull(shotLists.deletedAt)))
      .limit(1);

    return records[0] ?? null;
  }

  public async upsertShotList(input: UpsertShotListInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const existing = await this.getBySessionId(input.sessionId);

    if (!existing) {
      const inserted = {
        id: createUuid(),
        sessionId: input.sessionId,
        items: input.items,
        notes: input.notes ?? null,
        createdAt: occurredAt,
        updatedAt: occurredAt,
        deletedAt: null,
        version: 1,
      };

      await this.database.insert(shotLists).values(inserted);

      return this.recordMutation(context, {
        entityName: "shot_list",
        eventName: "created",
        entityId: inserted.id,
        before: null,
        after: inserted,
        result: inserted,
      });
    }

    const updated = {
      ...existing,
      items: input.items,
      notes: input.notes ?? null,
      updatedAt: occurredAt,
      version: existing.version + 1,
    };

    await this.database
      .update(shotLists)
      .set({
        items: updated.items,
        notes: updated.notes,
        updatedAt: updated.updatedAt,
        version: updated.version,
      })
      .where(eq(shotLists.id, existing.id));

    return this.recordMutation(context, {
      entityName: "shot_list",
      eventName: "updated",
      entityId: existing.id,
      before: existing,
      after: updated,
      result: updated,
    });
  }
}
