// Stage 4 Session List Lambda Purpose
import { sessionStatuses, type SessionStatus } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const status = event.queryStringParameters?.status;
  if (status && !sessionStatuses.includes(status as SessionStatus)) {
    return jsonResponse(400, { error: "status is invalid." });
  }

  const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : undefined;
  const from = event.queryStringParameters?.from ? new Date(event.queryStringParameters.from) : undefined;
  const to = event.queryStringParameters?.to ? new Date(event.queryStringParameters.to) : undefined;
  const { sessionsService } = createStage3Services();
  const sessions = await sessionsService.listSessions({
    clientId: event.queryStringParameters?.client_id,
    status: status as SessionStatus | undefined,
    from,
    to,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return jsonResponse(200, { sessions });
};
