// Stage 3 Activities Service Purpose
import { and, desc, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { activities } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateActivityInput = {
  readonly clientId?: string | null;
  readonly scopeType: string;
  readonly scopeId?: string | null;
  readonly channel: "email" | "sms" | "note" | "system";
  readonly direction: "inbound" | "outbound" | "internal" | "system";
  readonly activityType: string;
  readonly subject?: string | null;
  readonly body?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly externalMessageId?: string | null;
  readonly inReplyTo?: string | null;
  readonly occurredAt?: Date;
  readonly readAt?: Date | null;
};

export type ListInboxInput = {
  readonly unreadOnly?: boolean;
  readonly clientId?: string;
  readonly scopeType?: string;
  readonly scopeId?: string;
  readonly limit?: number;
};

export class ActivitiesService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createActivity(input: CreateActivityInput, context: MutationContext) {
    const occurredAt = input.occurredAt ?? context.occurredAt ?? new Date();
    const inserted = {
      id: createUuid(),
      clientId: input.clientId ?? null,
      scopeType: input.scopeType,
      scopeId: input.scopeId ?? null,
      channel: input.channel,
      direction: input.direction,
      activityType: input.activityType,
      subject: input.subject ?? null,
      body: input.body ?? null,
      metadata: input.metadata ?? {},
      externalMessageId: input.externalMessageId ?? null,
      inReplyTo: input.inReplyTo ?? null,
      occurredAt,
      readAt: input.readAt ?? null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    await this.database.insert(activities).values(inserted);

    return this.recordMutation(context, {
      entityName: "activity",
      eventName: "created",
      entityId: inserted.id,
      before: null,
      after: inserted,
      result: inserted,
    });
  }

  public async getActivityByExternalMessageId(externalMessageId: string) {
    const records = await this.database
      .select()
      .from(activities)
      .where(
        and(
          eq(activities.externalMessageId, externalMessageId),
          isNull(activities.deletedAt),
        ),
      )
      .limit(1);

    return records[0] ?? null;
  }

  public async listInbox(input: ListInboxInput = {}) {
    return this.database
      .select()
      .from(activities)
      .where(
        and(
          isNull(activities.deletedAt),
          input.unreadOnly ? isNull(activities.readAt) : undefined,
          input.clientId ? eq(activities.clientId, input.clientId) : undefined,
          input.scopeType ? eq(activities.scopeType, input.scopeType) : undefined,
          input.scopeId ? eq(activities.scopeId, input.scopeId) : undefined,
        ),
      )
      .orderBy(desc(activities.occurredAt))
      .limit(Math.min(input.limit ?? 50, 100));
  }

  public async getClientTimeline(clientId: string, limit = 100) {
    return this.database
      .select()
      .from(activities)
      .where(and(eq(activities.clientId, clientId), isNull(activities.deletedAt)))
      .orderBy(desc(activities.occurredAt))
      .limit(Math.min(limit, 200));
  }
}
