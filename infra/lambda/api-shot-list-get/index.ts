// Stage 4 Shot List Get Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const sessionId = event.pathParameters?.id;
  if (!sessionId) {
    return jsonResponse(400, { error: "session id is required." });
  }

  const { sessionsService, shotListsService } = createStage3Services();
  const session = await sessionsService.getSessionById(sessionId);
  if (!session) {
    return jsonResponse(404, { error: "session not found." });
  }

  const shotList = await shotListsService.getBySessionId(sessionId);
  return jsonResponse(200, { session, shotList });
};
