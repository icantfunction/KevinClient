// Stage 8 Referrals Report Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (_event: APIGatewayProxyEventV2) => {
  const { reportsService } = createStage3Services();
  return jsonResponse(200, { report: await reportsService.getReferralsReport() });
};
