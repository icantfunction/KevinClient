// Stage 2 Base Service Purpose
import type { StudioOsDatabase } from "../client";
import { publishDomainMutationEvent } from "../events/publisher";
import { AuditLogService } from "./audit-log-service";

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

  public constructor(protected readonly database: StudioOsDatabase) {
    this.auditLogService = new AuditLogService(database);
  }

  protected async recordMutation<TRecord extends Record<string, unknown>>(
    context: MutationContext,
    envelope: MutationEnvelope<TRecord>,
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
    });

    await publishDomainMutationEvent({
      entityName: envelope.entityName,
      eventName: envelope.eventName,
      entityId: envelope.entityId,
      actor: context.actor,
      occurredAt: occurredAt.toISOString(),
      before: envelope.before,
      after: envelope.after,
    });

    return envelope.result;
  }
}
