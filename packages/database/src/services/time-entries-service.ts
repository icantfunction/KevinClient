// Stage 10 Time Entries Service Purpose
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { timeEntries, type TimeEntryScope } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateTimeEntryInput = {
  readonly scope: TimeEntryScope;
  readonly scopeId?: string | null;
  readonly title: string;
  readonly startedAt?: Date;
  readonly endedAt?: Date | null;
  readonly notes?: string | null;
};

export class TimeEntriesService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createTimeEntry(input: CreateTimeEntryInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const startedAt = input.startedAt ?? occurredAt;
    const endedAt = input.endedAt ?? null;
    const durationMinutes = endedAt ? this.calculateDurationMinutes(startedAt, endedAt) : 0;

    const inserted = {
      id: createUuid(),
      scope: input.scope,
      scopeId: input.scopeId ?? null,
      title: input.title.trim(),
      startedAt,
      endedAt,
      durationMinutes,
      notes: input.notes?.trim() || null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    return this.persistMutation(context, async (database) => {
      await database.insert(timeEntries).values(inserted);

      return {
        entityName: "time_entry",
        eventName: "created",
        entityId: inserted.id,
        before: null,
        after: inserted,
        result: inserted,
      };
    });
  }

  public async stopTimeEntry(
    id: string,
    input: {
      readonly endedAt?: Date;
      readonly notes?: string | null;
      readonly title?: string | null;
    },
    context: MutationContext,
  ) {
    const existing = await this.getTimeEntryById(id);
    if (!existing) {
      throw new Error(`Time entry ${id} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const endedAt = input.endedAt ?? occurredAt;
    const updated = {
      ...existing,
      title: input.title?.trim() || existing.title,
      endedAt,
      durationMinutes: this.calculateDurationMinutes(existing.startedAt, endedAt),
      notes: input.notes !== undefined ? input.notes?.trim() || null : existing.notes,
      updatedAt: occurredAt,
      version: existing.version + 1,
    };

    return this.persistMutation(context, async (database) => {
      await database
        .update(timeEntries)
        .set({
          title: updated.title,
          endedAt: updated.endedAt,
          durationMinutes: updated.durationMinutes,
          notes: updated.notes,
          updatedAt: updated.updatedAt,
          version: updated.version,
        })
        .where(eq(timeEntries.id, id));

      return {
        entityName: "time_entry",
        eventName: "stopped",
        entityId: id,
        before: existing,
        after: updated,
        result: updated,
      };
    });
  }

  public async getTimeEntryById(id: string) {
    const records = await this.database
      .select()
      .from(timeEntries)
      .where(and(eq(timeEntries.id, id), isNull(timeEntries.deletedAt)))
      .limit(1);

    return records[0] ?? null;
  }

  public async getActiveTimeEntry() {
    const records = await this.database
      .select()
      .from(timeEntries)
      .where(and(isNull(timeEntries.deletedAt), isNull(timeEntries.endedAt)))
      .orderBy(desc(timeEntries.startedAt))
      .limit(1);

    return records[0] ?? null;
  }

  public async listTimeEntries(input: {
    readonly scope?: TimeEntryScope;
    readonly scopeId?: string;
    readonly from?: Date;
    readonly to?: Date;
    readonly activeOnly?: boolean;
    readonly limit?: number;
  } = {}) {
    return this.database
      .select()
      .from(timeEntries)
      .where(
        and(
          isNull(timeEntries.deletedAt),
          input.scope ? eq(timeEntries.scope, input.scope) : undefined,
          input.scopeId ? eq(timeEntries.scopeId, input.scopeId) : undefined,
          input.from ? gte(timeEntries.startedAt, input.from) : undefined,
          input.to ? lte(timeEntries.startedAt, input.to) : undefined,
          input.activeOnly ? isNull(timeEntries.endedAt) : undefined,
        ),
      )
      .orderBy(desc(timeEntries.startedAt))
      .limit(Math.min(input.limit ?? 50, 200));
  }

  public async summarize(referenceDate = new Date()) {
    const startOfToday = new Date(referenceDate);
    startOfToday.setUTCHours(0, 0, 0, 0);
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - ((startOfWeek.getUTCDay() + 6) % 7));

    const [todayEntries, weekEntries, activeEntry] = await Promise.all([
      this.listTimeEntries({ from: startOfToday, limit: 200 }),
      this.listTimeEntries({ from: startOfWeek, limit: 500 }),
      this.getActiveTimeEntry(),
    ]);

    return {
      activeEntry,
      todayMinutes: todayEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
      weekMinutes: weekEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
      recentEntries: weekEntries.slice(0, 10),
    };
  }

  private calculateDurationMinutes(startedAt: Date, endedAt: Date) {
    return Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000));
  }
}
