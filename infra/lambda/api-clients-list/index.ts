// Stage 10 Clients List Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const { clientsService } = createStage3Services();
  const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : undefined;
  const clients = await clientsService.listClients({
    query: event.queryStringParameters?.q,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return jsonResponse(200, { clients });
};
