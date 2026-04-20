// Stage 8 Invoices Get Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const invoiceId = event.pathParameters?.id;
  if (!invoiceId) {
    return jsonResponse(400, { error: "invoice id is required." });
  }

  const { invoicesService, paymentsService } = createStage3Services();
  const invoice = await invoicesService.getInvoiceById(invoiceId);
  if (!invoice) {
    return jsonResponse(404, { error: "invoice not found." });
  }

  const payments = await paymentsService.listPayments({ invoiceId });
  return jsonResponse(200, { invoice, payments });
};
