// Stage 4 Tasks Service Purpose
import { and, asc, eq, gte, isNull, lte, ne } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { tasks } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateTaskInput = {
  readonly scope: "standalone" | "session" | "studio_booking" | "admin";
  readonly scopeId?: string | null;
  readonly title: string;
  readonly description?: string | null;
  readonly status?: "todo" | "doing" | "waiting_client" | "waiting_vendor" | "blocked" | "done";
  readonly priority?: "low" | "medium" | "high" | "urgent";
  readonly dueAt?: Date | null;
  readonly actualDoneAt?: Date | null;
  readonly blockedReason?: string | null;
  readonly recurringRule?: string | null;
  readonly notes?: string | null;
};

export class TasksService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createTask(input: CreateTaskInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const inserted = {
      id: createUuid(),
      scope: input.scope,
      scopeId: input.scopeId ?? null,
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      dueAt: input.dueAt ?? null,
      actualDoneAt: input.actualDoneAt ?? null,
      blockedReason: input.blockedReason ?? null,
      recurringRule: input.recurringRule ?? null,
      notes: input.notes ?? null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    return this.persistMutation(context, async (database) => {
      await database.insert(tasks).values(inserted);

      return {
        entityName: "task",
        eventName: "created",
        entityId: inserted.id,
        before: null,
        after: inserted,
        result: inserted,
      };
    });
  }

  public async listTasks(input: {
    readonly scope?: "standalone" | "session" | "studio_booking" | "admin";
    readonly scopeId?: string;
    readonly status?: "todo" | "doing" | "waiting_client" | "waiting_vendor" | "blocked" | "done";
    readonly from?: Date;
    readonly to?: Date;
    readonly includeDone?: boolean;
    readonly limit?: number;
  } = {}) {
    return this.database
      .select()
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          input.scope ? eq(tasks.scope, input.scope) : undefined,
          input.scopeId ? eq(tasks.scopeId, input.scopeId) : undefined,
          input.status ? eq(tasks.status, input.status) : undefined,
          input.from ? gte(tasks.dueAt, input.from) : undefined,
          input.to ? lte(tasks.dueAt, input.to) : undefined,
          input.includeDone ? undefined : ne(tasks.status, "done"),
        ),
      )
      .orderBy(asc(tasks.dueAt))
      .limit(Math.min(input.limit ?? 100, 200));
  }

  public async findTask(input: {
    readonly scope: "standalone" | "session" | "studio_booking" | "admin";
    readonly scopeId?: string | null;
    readonly title: string;
  }) {
    const records = await this.database
      .select()
      .from(tasks)
      .where(
        and(
          isNull(tasks.deletedAt),
          eq(tasks.scope, input.scope),
          input.scopeId === undefined ? undefined : input.scopeId === null ? isNull(tasks.scopeId) : eq(tasks.scopeId, input.scopeId),
          eq(tasks.title, input.title),
        ),
      )
      .limit(1);

    return records[0] ?? null;
  }
}
