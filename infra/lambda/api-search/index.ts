// Stage 10 Search Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const query = event.queryStringParameters?.q?.trim();
  if (!query || query.length < 2) {
    return jsonResponse(200, { results: [] });
  }

  const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : undefined;
  const { searchService } = createStage3Services();
  const results = await searchService.searchAll({
    query,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return jsonResponse(200, { results });
};
