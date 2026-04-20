// Stage 4 Session Create Lambda Purpose
import { buildSessionTaskTemplates, sessionStatuses, sessionTypes, type SessionStatus, type SessionType } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreateSessionRequest = {
  readonly clientId?: string;
  readonly sessionType?: string;
  readonly title?: string;
  readonly status?: string;
  readonly scheduledStart?: string | null;
  readonly scheduledEnd?: string | null;
  readonly locationName?: string | null;
  readonly locationAddress?: string | null;
  readonly usesOwnStudio?: boolean;
  readonly notes?: string | null;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");

  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/sessions:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateSessionRequest>(event);

    if (!payload.clientId || !payload.title?.trim() || !payload.sessionType) {
      return jsonResponse(400, { error: "clientId, title, and sessionType are required." });
    }

    if (!sessionTypes.includes(payload.sessionType as SessionType)) {
      return jsonResponse(400, { error: "sessionType is invalid." });
    }

    if (payload.status && !sessionStatuses.includes(payload.status as SessionStatus)) {
      return jsonResponse(400, { error: "status is invalid." });
    }

    const { activitiesService, sessionsService, tasksService } = createStage3Services();
    const occurredAt = new Date();
    const scheduledStart = payload.scheduledStart ? new Date(payload.scheduledStart) : null;
    const scheduledEnd = payload.scheduledEnd ? new Date(payload.scheduledEnd) : null;
    const session = await sessionsService.createSession(
      {
        clientId: payload.clientId,
        sessionType: payload.sessionType as SessionType,
        title: payload.title.trim(),
        status: (payload.status as SessionStatus | undefined) ?? "scheduled",
        scheduledStart,
        scheduledEnd,
        locationName: payload.locationName?.trim() || null,
        locationAddress: payload.locationAddress?.trim() || null,
        usesOwnStudio: payload.usesOwnStudio ?? false,
        notes: payload.notes?.trim() || null,
      },
      { actor: "kevin", occurredAt },
    );

    const createdTasks = [];
    if (scheduledStart) {
      for (const template of buildSessionTaskTemplates(payload.sessionType as SessionType)) {
        const dueAt = new Date(scheduledStart.getTime() + template.offsetDays * 24 * 60 * 60 * 1000);
        const task = await tasksService.createTask(
          {
            scope: "session",
            scopeId: session.id,
            title: template.title,
            description: template.description,
            priority: template.priority,
            dueAt,
          },
          { actor: "system", occurredAt },
        );
        createdTasks.push(task);
      }
    }

    await activitiesService.createActivity(
      {
        clientId: session.clientId,
        scopeType: "session",
        scopeId: session.id,
        channel: "system",
        direction: "internal",
        activityType: "session.created",
        subject: session.title,
        body: `Session ${session.title} created.`,
        occurredAt,
        metadata: {
          sessionType: session.sessionType,
          status: session.status,
          spawnedTaskCount: createdTasks.length,
        },
      },
      { actor: "kevin", occurredAt },
    );

    const response = jsonResponse(201, {
      session,
      spawnedTaskCount: createdTasks.length,
    });

    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
