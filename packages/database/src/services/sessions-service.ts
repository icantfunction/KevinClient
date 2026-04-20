// Stage 4 Sessions Service Purpose
import { and, asc, desc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { sessions, type SessionStatus, type SessionTimelineItem, type SessionType, type SessionWeatherForecast } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateSessionInput = {
  readonly clientId: string;
  readonly sessionType: SessionType;
  readonly title: string;
  readonly status?: SessionStatus;
  readonly scheduledStart?: Date | null;
  readonly scheduledEnd?: Date | null;
  readonly actualStart?: Date | null;
  readonly actualEnd?: Date | null;
  readonly locationName?: string | null;
  readonly locationAddress?: string | null;
  readonly locationCoords?: { readonly lat?: number; readonly lng?: number };
  readonly locationNotes?: string | null;
  readonly timeline?: SessionTimelineItem[];
  readonly secondShooterName?: string | null;
  readonly assistantName?: string | null;
  readonly gearNotes?: string | null;
  readonly shotListId?: string | null;
  readonly contractId?: string | null;
  readonly questionnaireResponseId?: string | null;
  readonly invoiceIds?: string[];
  readonly galleryId?: string | null;
  readonly weatherForecast?: SessionWeatherForecast;
  readonly usesOwnStudio?: boolean;
  readonly notes?: string | null;
};

export type UpdateSessionInput = Partial<CreateSessionInput>;

export type ListSessionsInput = {
  readonly clientId?: string;
  readonly status?: SessionStatus;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
};

export type CalendarEntry = {
  readonly entryType: "session" | "task" | "inquiry";
  readonly id: string;
  readonly title: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly status: string | null;
  readonly color: string;
  readonly scopeType: string;
  readonly scopeId: string;
  readonly clientId: string | null;
};

type RawCalendarEntry = {
  readonly entry_type: "session" | "task" | "inquiry";
  readonly id: string;
  readonly title: string;
  readonly starts_at: string | Date;
  readonly ends_at: string | Date | null;
  readonly status: string | null;
  readonly color: string;
  readonly scope_type: string;
  readonly scope_id: string;
  readonly client_id: string | null;
};

export class SessionsService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createSession(input: CreateSessionInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const inserted = {
      id: createUuid(),
      clientId: input.clientId,
      sessionType: input.sessionType,
      title: input.title,
      status: input.status ?? "scheduled",
      scheduledStart: input.scheduledStart ?? null,
      scheduledEnd: input.scheduledEnd ?? null,
      actualStart: input.actualStart ?? null,
      actualEnd: input.actualEnd ?? null,
      locationName: input.locationName ?? null,
      locationAddress: input.locationAddress ?? null,
      locationCoords: input.locationCoords ?? {},
      locationNotes: input.locationNotes ?? null,
      timeline: input.timeline ?? [],
      secondShooterName: input.secondShooterName ?? null,
      assistantName: input.assistantName ?? null,
      gearNotes: input.gearNotes ?? null,
      shotListId: input.shotListId ?? null,
      contractId: input.contractId ?? null,
      questionnaireResponseId: input.questionnaireResponseId ?? null,
      invoiceIds: input.invoiceIds ?? [],
      galleryId: input.galleryId ?? null,
      weatherForecast: input.weatherForecast ?? {},
      usesOwnStudio: input.usesOwnStudio ?? false,
      notes: input.notes ?? null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    await this.database.insert(sessions).values(inserted);

    return this.recordMutation(context, {
      entityName: "session",
      eventName: "created",
      entityId: inserted.id,
      before: null,
      after: inserted,
      result: inserted,
    });
  }

  public async attachShotList(sessionId: string, shotListId: string, context: MutationContext) {
    const existing = await this.getSessionById(sessionId);
    if (!existing) {
      throw new Error(`Session ${sessionId} was not found.`);
    }

    const updated = {
      ...existing,
      shotListId,
      updatedAt: context.occurredAt ?? new Date(),
      version: existing.version + 1,
    };

    await this.database
      .update(sessions)
      .set({
        shotListId: updated.shotListId,
        updatedAt: updated.updatedAt,
        version: updated.version,
      })
      .where(eq(sessions.id, sessionId));

    return this.recordMutation(context, {
      entityName: "session",
      eventName: "updated",
      entityId: sessionId,
      before: existing,
      after: updated,
      result: updated,
    });
  }

  public async updateSession(id: string, input: UpdateSessionInput, context: MutationContext) {
    const existing = await this.getSessionById(id);
    if (!existing) {
      throw new Error(`Session ${id} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const updated = {
      ...existing,
      clientId: input.clientId ?? existing.clientId,
      sessionType: input.sessionType ?? existing.sessionType,
      title: input.title ?? existing.title,
      status: input.status ?? existing.status,
      scheduledStart: input.scheduledStart !== undefined ? input.scheduledStart : existing.scheduledStart,
      scheduledEnd: input.scheduledEnd !== undefined ? input.scheduledEnd : existing.scheduledEnd,
      actualStart: input.actualStart !== undefined ? input.actualStart : existing.actualStart,
      actualEnd: input.actualEnd !== undefined ? input.actualEnd : existing.actualEnd,
      locationName: input.locationName !== undefined ? input.locationName : existing.locationName,
      locationAddress: input.locationAddress !== undefined ? input.locationAddress : existing.locationAddress,
      locationCoords: input.locationCoords ?? existing.locationCoords,
      locationNotes: input.locationNotes !== undefined ? input.locationNotes : existing.locationNotes,
      timeline: input.timeline ?? existing.timeline,
      secondShooterName: input.secondShooterName !== undefined ? input.secondShooterName : existing.secondShooterName,
      assistantName: input.assistantName !== undefined ? input.assistantName : existing.assistantName,
      gearNotes: input.gearNotes !== undefined ? input.gearNotes : existing.gearNotes,
      shotListId: input.shotListId !== undefined ? input.shotListId : existing.shotListId,
      contractId: input.contractId !== undefined ? input.contractId : existing.contractId,
      questionnaireResponseId:
        input.questionnaireResponseId !== undefined ? input.questionnaireResponseId : existing.questionnaireResponseId,
      invoiceIds: input.invoiceIds ?? existing.invoiceIds,
      galleryId: input.galleryId !== undefined ? input.galleryId : existing.galleryId,
      weatherForecast: input.weatherForecast ?? existing.weatherForecast,
      usesOwnStudio: input.usesOwnStudio ?? existing.usesOwnStudio,
      notes: input.notes !== undefined ? input.notes : existing.notes,
      updatedAt: occurredAt,
      version: existing.version + 1,
    };

    await this.database
      .update(sessions)
      .set({
        clientId: updated.clientId,
        sessionType: updated.sessionType,
        title: updated.title,
        status: updated.status,
        scheduledStart: updated.scheduledStart,
        scheduledEnd: updated.scheduledEnd,
        actualStart: updated.actualStart,
        actualEnd: updated.actualEnd,
        locationName: updated.locationName,
        locationAddress: updated.locationAddress,
        locationCoords: updated.locationCoords,
        locationNotes: updated.locationNotes,
        timeline: updated.timeline,
        secondShooterName: updated.secondShooterName,
        assistantName: updated.assistantName,
        gearNotes: updated.gearNotes,
        shotListId: updated.shotListId,
        contractId: updated.contractId,
        questionnaireResponseId: updated.questionnaireResponseId,
        invoiceIds: updated.invoiceIds,
        galleryId: updated.galleryId,
        weatherForecast: updated.weatherForecast,
        usesOwnStudio: updated.usesOwnStudio,
        notes: updated.notes,
        updatedAt: updated.updatedAt,
        version: updated.version,
      })
      .where(eq(sessions.id, id));

    return this.recordMutation(context, {
      entityName: "session",
      eventName: "updated",
      entityId: id,
      before: existing,
      after: updated,
      result: updated,
    });
  }

  public async getSessionById(id: string) {
    const records = await this.database
      .select()
      .from(sessions)
      .where(and(eq(sessions.id, id), isNull(sessions.deletedAt)))
      .limit(1);

    return records[0] ?? null;
  }

  public async listSessions(input: ListSessionsInput = {}) {
    return this.database
      .select()
      .from(sessions)
      .where(
        and(
          isNull(sessions.deletedAt),
          input.clientId ? eq(sessions.clientId, input.clientId) : undefined,
          input.status ? eq(sessions.status, input.status) : undefined,
          input.from ? gte(sessions.scheduledStart, input.from) : undefined,
          input.to ? lte(sessions.scheduledStart, input.to) : undefined,
        ),
      )
      .orderBy(asc(sessions.scheduledStart))
      .limit(Math.min(input.limit ?? 100, 200));
  }

  public async listCalendarEntries(from: Date, to: Date): Promise<CalendarEntry[]> {
    const result = await this.database.execute(sql`
      with session_entries as (
        select
          'session'::text as entry_type,
          s.id::text as id,
          s.title::text as title,
          s.scheduled_start as starts_at,
          s.scheduled_end as ends_at,
          s.status::text as status,
          '#0f766e'::text as color,
          'session'::text as scope_type,
          s.id::text as scope_id,
          s.client_id::text as client_id
        from sessions s
        where s.deleted_at is null
          and s.scheduled_start is not null
          and s.scheduled_start between ${sql`${from}::timestamptz`} and ${sql`${to}::timestamptz`}
      ),
      task_entries as (
        select
          'task'::text as entry_type,
          t.id::text as id,
          t.title::text as title,
          t.due_at as starts_at,
          null::timestamptz as ends_at,
          t.status::text as status,
          '#b45309'::text as color,
          t.scope::text as scope_type,
          coalesce(t.scope_id::text, t.id::text) as scope_id,
          case when t.scope = 'session' then s.client_id::text else null end as client_id
        from tasks t
        left join sessions s on s.id = t.scope_id
        where t.deleted_at is null
          and t.due_at is not null
          and t.due_at between ${sql`${from}::timestamptz`} and ${sql`${to}::timestamptz`}
      ),
      inquiry_entries as (
        select
          'inquiry'::text as entry_type,
          i.id::text as id,
          concat('Inquiry: ', i.inquirer_name)::text as title,
          i.event_date as starts_at,
          null::timestamptz as ends_at,
          i.status::text as status,
          '#1d4ed8'::text as color,
          'inquiry'::text as scope_type,
          i.id::text as scope_id,
          null::text as client_id
        from inquiries i
        where i.deleted_at is null
          and i.event_date is not null
          and i.event_date between ${sql`${from}::timestamptz`} and ${sql`${to}::timestamptz`}
      )
      select * from session_entries
      union all
      select * from task_entries
      union all
      select * from inquiry_entries
      order by starts_at asc
    `);

    return (result.rows as unknown as RawCalendarEntry[]).map((row) => ({
      entryType: row.entry_type,
      id: row.id,
      title: row.title,
      startsAt: new Date(row.starts_at),
      endsAt: row.ends_at ? new Date(row.ends_at) : null,
      status: row.status,
      color: row.color,
      scopeType: row.scope_type,
      scopeId: row.scope_id,
      clientId: row.client_id,
    }));
  }

  public async getDashboardSummary(now: Date) {
    const result = await this.database.execute(sql`
      select
        (select count(*)::int from inquiries where deleted_at is null and status = 'new') as new_inquiry_count,
        (select count(*)::int from sessions where deleted_at is null and status in ('scheduled', 'confirmed')) as active_session_count,
        (select count(*)::int from tasks where deleted_at is null and status <> 'done') as open_task_count
    `);

    const upcomingSessions = await this.listSessions({
      from: now,
      limit: 5,
    });

    return {
      ...(result.rows[0] as Record<string, number>),
      upcomingSessions,
    };
  }
}
