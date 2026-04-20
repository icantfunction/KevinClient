// Stage 7 Studio Equipment List Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const activeOnly = event.queryStringParameters?.active_only === "true";
  const { equipmentService } = createStage3Services();
  const equipment = await equipmentService.listEquipment({ activeOnly });

  return jsonResponse(200, { equipment });
};
