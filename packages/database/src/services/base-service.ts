// Stage 2 Base Service Purpose
import type { StudioOsDatabase, StudioOsDatabaseExecutor } from "../client";
import { createUuid } from "../utils/uuid";
import { AuditLogService } from "./audit-log-service";
import { EventOutboxService } from "./event-outbox-service";

export type MutationContext = {
  readonly actor: string;
  readonly occurredAt?: Date;
};

export type MutationEnvelope<TRecord extends Record<string, unknown>> = {
  readonly entityName: string;
  readonly eventName: string;
  readonly entityId: string;
  readonly before: TRecord | null;
  readonly after: TRecord | null;
  readonly result: TRecord;
};

export class BaseDomainService {
  protected readonly auditLogService: AuditLogService;
  protected readonly eventOutboxService: EventOutboxService;

  public constructor(protected readonly database: StudioOsDatabase) {
    this.auditLogService = new AuditLogService(database);
    this.eventOutboxService = new EventOutboxService(database);
  }

  protected async recordMutation<TRecord extends Record<string, unknown>>(
    context: MutationContext,
    envelope: MutationEnvelope<TRecord>,
    executor: StudioOsDatabaseExecutor = this.database,
  ): Promise<TRecord> {
    const occurredAt = context.occurredAt ?? new Date();

    await this.auditLogService.record({
      entityType: envelope.entityName,
      entityId: envelope.entityId,
      action: envelope.eventName,
      actor: context.actor,
      loggedAt: occurredAt,
      before: envelope.before,
      after: envelope.after,
    }, executor);

    const eventId = createUuid();
    await this.eventOutboxService.enqueue(
      {
        id: eventId,
        entityType: envelope.entityName,
        entityId: envelope.entityId,
        eventName: envelope.eventName,
        detail: {
          eventId,
          entityName: envelope.entityName,
          eventName: envelope.eventName,
          entityId: envelope.entityId,
          actor: context.actor,
          occurredAt: occurredAt.toISOString(),
          before: envelope.before,
          after: envelope.after,
        },
        createdAt: occurredAt,
      },
      executor,
    );

    return envelope.result;
  }

  protected async persistMutation<TRecord extends Record<string, unknown>>(
    context: MutationContext,
    operation: (executor: StudioOsDatabaseExecutor) => Promise<MutationEnvelope<TRecord>>,
  ): Promise<TRecord> {
    return this.database.transaction(async (transaction) => {
      const envelope = await operation(transaction);
      await this.recordMutation(context, envelope, transaction);
      return envelope.result;
    });
  }
}
