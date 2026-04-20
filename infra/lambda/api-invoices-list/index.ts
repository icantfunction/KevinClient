// Stage 8 Invoices List Lambda Purpose
import { invoiceStatuses } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const status = event.queryStringParameters?.status;
  if (status && !invoiceStatuses.includes(status as never)) {
    return jsonResponse(400, { error: "status is invalid." });
  }

  const { invoicesService } = createStage3Services();
  const invoices = await invoicesService.listInvoices({
    clientId: event.queryStringParameters?.clientId,
    status: status as (typeof invoiceStatuses)[number] | undefined,
  });

  return jsonResponse(200, { invoices });
};
