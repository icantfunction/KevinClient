// Stage 10 Time Entry Stop Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type StopTimeEntryRequest = {
  readonly endedAt?: string;
  readonly notes?: string | null;
  readonly title?: string | null;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const timeEntryId = event.pathParameters?.id;
  if (!timeEntryId) {
    return jsonResponse(400, { error: "time entry id is required." });
  }

  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/time-entries/${timeEntryId}/stop:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = event.body ? parseJsonBody<StopTimeEntryRequest>(event) : {};
    const { timeEntriesService } = createStage3Services();
    const timeEntry = await timeEntriesService.stopTimeEntry(
      timeEntryId,
      {
        endedAt: payload.endedAt ? new Date(payload.endedAt) : undefined,
        notes: payload.notes,
        title: payload.title,
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    const response = jsonResponse(200, { timeEntry });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
