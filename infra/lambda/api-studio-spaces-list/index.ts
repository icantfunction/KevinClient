// Stage 7 Studio Spaces List Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const activeOnly = event.queryStringParameters?.active_only === "true";
  const { spacesService } = createStage3Services();
  const spaces = await spacesService.listSpaces({ activeOnly });

  return jsonResponse(200, { spaces });
};
