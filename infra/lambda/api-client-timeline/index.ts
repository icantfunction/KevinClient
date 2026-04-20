// Stage 3 Client Timeline Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const clientId = event.pathParameters?.id;
  const limitValue = event.queryStringParameters?.limit;
  const limit = limitValue ? Number(limitValue) : undefined;

  if (!clientId) {
    return jsonResponse(400, {
      error: "client id is required.",
    });
  }

  const { activitiesService, clientsService } = createStage3Services();
  const client = await clientsService.getClientById(clientId);

  if (!client) {
    return jsonResponse(404, {
      error: "client not found.",
    });
  }

  const timeline = await activitiesService.getClientTimeline(clientId, Number.isFinite(limit) ? limit : 100);

  return jsonResponse(200, {
    client,
    timeline,
  });
};
