// Stage 8 Revenue Report Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const yearValue = event.queryStringParameters?.year;
  const year = yearValue ? Number(yearValue) : new Date().getUTCFullYear();
  if (!Number.isInteger(year) || year < 2020 || year > 2100) {
    return jsonResponse(400, { error: "year is invalid." });
  }

  const { reportsService } = createStage3Services();
  return jsonResponse(200, { report: await reportsService.getRevenueReport(year) });
};
