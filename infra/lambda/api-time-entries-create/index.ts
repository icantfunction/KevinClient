// Stage 10 Time Entry Create Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { type TimeEntryScope } from "@studio-os/database";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreateTimeEntryRequest = {
  readonly scope?: TimeEntryScope;
  readonly scopeId?: string | null;
  readonly title?: string;
  readonly startedAt?: string;
  readonly endedAt?: string | null;
  readonly notes?: string | null;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/time-entries:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateTimeEntryRequest>(event);
    if (!payload.scope || !payload.title?.trim()) {
      await abandonIdempotentRequest(idempotencyKey);
      return jsonResponse(400, { error: "scope and title are required." });
    }

    const { timeEntriesService } = createStage3Services();
    const timeEntry = await timeEntriesService.createTimeEntry(
      {
        scope: payload.scope,
        scopeId: payload.scopeId ?? null,
        title: payload.title.trim(),
        startedAt: payload.startedAt ? new Date(payload.startedAt) : undefined,
        endedAt: payload.endedAt ? new Date(payload.endedAt) : null,
        notes: payload.notes?.trim() || null,
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    const response = jsonResponse(201, { timeEntry });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
