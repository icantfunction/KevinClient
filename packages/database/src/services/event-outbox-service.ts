// Stage 11.5 Event Outbox Service Purpose
import { and, asc, eq, gt, isNull, sql } from "drizzle-orm";
import type { StudioOsDatabase, StudioOsDatabaseExecutor } from "../client";
import { eventOutbox } from "../schema";
import { createUuid } from "../utils/uuid";

export type OutboxDomainEventDetail = {
  readonly eventId: string;
  readonly entityName: string;
  readonly eventName: string;
  readonly entityId: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
};

export type EnqueueOutboxEventInput = {
  readonly id?: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly eventName: string;
  readonly detail: OutboxDomainEventDetail;
  readonly createdAt?: Date;
};

type OutboxHealthRow = {
  readonly unpublished_count: number | string;
  readonly failed_count: number | string;
  readonly stale_count: number | string;
  readonly oldest_unpublished_age_seconds: number | string | null;
};

export class EventOutboxService {
  public constructor(private readonly database: StudioOsDatabase) {}

  public async enqueue(input: EnqueueOutboxEventInput, executor: StudioOsDatabaseExecutor = this.database) {
    const createdAt = input.createdAt ?? new Date();
    const id = input.id ?? createUuid();

    await executor.insert(eventOutbox).values({
      id,
      entityType: input.entityType,
      entityId: input.entityId,
      eventName: input.eventName,
      detail: input.detail,
      publishedAt: null,
      attemptCount: 0,
      lastError: null,
      createdAt,
      updatedAt: createdAt,
      deletedAt: null,
      version: 1,
    });

    return id;
  }

  public async listPending(limit = 100) {
    return this.database
      .select()
      .from(eventOutbox)
      .where(and(isNull(eventOutbox.deletedAt), isNull(eventOutbox.publishedAt)))
      .orderBy(asc(eventOutbox.createdAt), asc(eventOutbox.id))
      .limit(Math.min(limit, 100));
  }

  public async markPublished(id: string, publishedAt: Date) {
    const existing = await this.database
      .select({
        version: eventOutbox.version,
      })
      .from(eventOutbox)
      .where(eq(eventOutbox.id, id))
      .limit(1);

    const version = existing[0]?.version ?? 1;

    await this.database
      .update(eventOutbox)
      .set({
        publishedAt,
        updatedAt: publishedAt,
        lastError: null,
        version: version + 1,
      })
      .where(eq(eventOutbox.id, id));
  }

  public async markFailed(id: string, errorMessage: string, occurredAt: Date) {
    const trimmedError = errorMessage.trim().slice(0, 2000);

    await this.database
      .update(eventOutbox)
      .set({
        attemptCount: sql`${eventOutbox.attemptCount} + 1`,
        lastError: trimmedError,
        updatedAt: occurredAt,
        version: sql`${eventOutbox.version} + 1`,
      })
      .where(eq(eventOutbox.id, id));
  }

  public async getHealthSnapshot(now: Date = new Date()) {
    const staleBefore = new Date(now.getTime() - 5 * 60 * 1000);
    const result = await this.database.execute(sql`
      select
        count(*) filter (where published_at is null and deleted_at is null) as unpublished_count,
        count(*) filter (where published_at is null and deleted_at is null and attempt_count > 5) as failed_count,
        count(*) filter (where published_at is null and deleted_at is null and created_at < ${staleBefore}) as stale_count,
        max(extract(epoch from (${now}::timestamptz - created_at)))
          filter (where published_at is null and deleted_at is null) as oldest_unpublished_age_seconds
      from event_outbox
    `);

    const row = result.rows[0] as OutboxHealthRow | undefined;

    return {
      unpublishedCount: Number(row?.unpublished_count ?? 0),
      failedCount: Number(row?.failed_count ?? 0),
      staleCount: Number(row?.stale_count ?? 0),
      oldestUnpublishedAgeSeconds: Number(row?.oldest_unpublished_age_seconds ?? 0),
    };
  }

  public async listRetryExceeded() {
    return this.database
      .select()
      .from(eventOutbox)
      .where(and(isNull(eventOutbox.deletedAt), isNull(eventOutbox.publishedAt), gt(eventOutbox.attemptCount, 5)))
      .orderBy(asc(eventOutbox.createdAt), asc(eventOutbox.id));
  }
}
