// Stage 8 Payments List Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const { paymentsService } = createStage3Services();
  const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : undefined;
  const payments = await paymentsService.listPayments({
    invoiceId: event.queryStringParameters?.invoiceId,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return jsonResponse(200, { payments });
};
