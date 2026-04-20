// Stage 10 Time Entries Service Purpose
import { ExecuteStatementCommand, type SqlParameter } from "@aws-sdk/client-rds-data";
import { and, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { createRawRdsDataClient, type StudioOsDatabase } from "../client";
import { resolveDatabaseRuntimeConfig } from "../config";
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

export class TimeEntriesService extends BaseDomainService {
  private readonly rdsClient = createRawRdsDataClient();

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

    await this.executeStatement(
      `
        insert into time_entries (
          id,
          scope,
          scope_id,
          title,
          started_at,
          ended_at,
          duration_minutes,
          notes,
          created_at,
          updated_at,
          deleted_at,
          version
        )
        values (
          cast(:id as uuid),
          :scope,
          cast(:scope_id as uuid),
          :title,
          cast(:started_at as timestamptz),
          cast(:ended_at as timestamptz),
          :duration_minutes,
          :notes,
          cast(:created_at as timestamptz),
          cast(:updated_at as timestamptz),
          null,
          :version
        )
      `,
      [
        stringParam("id", inserted.id),
        stringParam("scope", inserted.scope),
        stringParam("scope_id", inserted.scopeId),
        stringParam("title", inserted.title),
        stringParam("started_at", inserted.startedAt.toISOString()),
        stringParam("ended_at", inserted.endedAt?.toISOString() ?? null),
        longParam("duration_minutes", inserted.durationMinutes),
        stringParam("notes", inserted.notes),
        stringParam("created_at", inserted.createdAt.toISOString()),
        stringParam("updated_at", inserted.updatedAt.toISOString()),
        longParam("version", inserted.version),
      ],
    );

    return this.recordMutation(context, {
      entityName: "time_entry",
      eventName: "created",
      entityId: inserted.id,
      before: null,
      after: inserted,
      result: inserted,
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

    await this.executeStatement(
      `
        update time_entries
        set
          title = :title,
          ended_at = cast(:ended_at as timestamptz),
          duration_minutes = :duration_minutes,
          notes = :notes,
          updated_at = cast(:updated_at as timestamptz),
          version = :version
        where id = cast(:id as uuid)
          and deleted_at is null
      `,
      [
        stringParam("id", id),
        stringParam("title", updated.title),
        stringParam("ended_at", updated.endedAt.toISOString()),
        longParam("duration_minutes", updated.durationMinutes),
        stringParam("notes", updated.notes),
        stringParam("updated_at", updated.updatedAt.toISOString()),
        longParam("version", updated.version),
      ],
    );

    return this.recordMutation(context, {
      entityName: "time_entry",
      eventName: "stopped",
      entityId: id,
      before: existing,
      after: updated,
      result: updated,
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

  private async executeStatement(statement: string, parameters: SqlParameter[]) {
    const runtime = resolveDatabaseRuntimeConfig();
    return this.rdsClient.send(
      new ExecuteStatementCommand({
        resourceArn: runtime.resourceArn,
        secretArn: runtime.secretArn,
        database: runtime.databaseName,
        sql: statement,
        parameters,
      }),
    );
  }
}
