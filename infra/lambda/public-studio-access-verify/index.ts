// Stage 7 Public Studio Access Verify Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse, parseJsonBody } from "../shared/http";

type StudioAccessVerifyRequest = {
  readonly accessCode?: string;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const payload = parseJsonBody<StudioAccessVerifyRequest>(event);
  if (!payload.accessCode?.trim()) {
    return jsonResponse(400, { error: "accessCode is required." });
  }

  const { studioBookingsService } = createStage3Services();
  const result = await studioBookingsService.verifyAccessCode(
    {
      accessCode: payload.accessCode.trim(),
      attemptedAt: new Date(),
      sourceIp: event.requestContext.http.sourceIp ?? null,
      userAgent: event.headers["user-agent"] ?? event.headers["User-Agent"] ?? null,
    },
    { actor: "client:studio_access", occurredAt: new Date() },
  );

  return jsonResponse(200, result);
};
