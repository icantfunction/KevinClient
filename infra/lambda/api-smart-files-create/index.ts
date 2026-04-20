// Stage 5 Smart File Create Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreateSmartFileRequest = {
  readonly templateId?: string;
  readonly clientId?: string | null;
  readonly inquiryId?: string | null;
  readonly sessionId?: string | null;
  readonly title?: string | null;
  readonly recipientEmail?: string | null;
  readonly recipientPhone?: string | null;
  readonly subject?: string | null;
  readonly message?: string | null;
  readonly expiresAt?: string | null;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const operation = await beginIdempotentRequest(`POST:/smart-files:${idempotencyHeader}`);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateSmartFileRequest>(event);
    if (!payload.templateId) {
      return jsonResponse(400, { error: "templateId is required." });
    }

    const { smartFilesService } = createStage3Services();
    const smartFile = await smartFilesService.instantiateSmartFile(
      {
        templateId: payload.templateId,
        clientId: payload.clientId ?? null,
        inquiryId: payload.inquiryId ?? null,
        sessionId: payload.sessionId ?? null,
        title: payload.title ?? null,
        recipientEmail: payload.recipientEmail ?? null,
        recipientPhone: payload.recipientPhone ?? null,
        subject: payload.subject ?? null,
        message: payload.message ?? null,
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    const response = jsonResponse(201, { smartFile });
    await completeIdempotentRequest(`POST:/smart-files:${idempotencyHeader}`, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(`POST:/smart-files:${idempotencyHeader}`);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
