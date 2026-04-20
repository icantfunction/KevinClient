// Stage 11 Invoice Checkout Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";
import { createPaymentProvider } from "../shared/payments";

type CreateInvoiceCheckoutRequest = {
  readonly amountCents?: number | null;
  readonly smartFileId?: string | null;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const invoiceId = event.pathParameters?.id;
  if (!invoiceId) {
    return jsonResponse(400, { error: "invoice id is required." });
  }

  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/invoices/${invoiceId}/checkout:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = event.body ? parseJsonBody<CreateInvoiceCheckoutRequest>(event) : {};
    const { clientsService, invoicesService } = createStage3Services();
    const invoice = await invoicesService.getInvoiceById(invoiceId);
    if (!invoice) {
      await abandonIdempotentRequest(idempotencyKey);
      return jsonResponse(404, { error: "invoice not found." });
    }

    const client = await clientsService.getClientById(invoice.clientId);
    const provider = await createPaymentProvider();
    const configuration = await provider.getConfiguration();
    if (!configuration.available) {
      await abandonIdempotentRequest(idempotencyKey);
      return jsonResponse(503, { error: configuration.reason ?? "Stripe is not configured." });
    }

    const checkout = await provider.createInvoiceCheckout({
      invoice,
      amountCents: payload.amountCents ?? null,
      smartFileId: payload.smartFileId ?? null,
      customerEmail: client?.email ?? null,
      customerName: client?.primaryName ?? null,
    });

    const response = jsonResponse(201, { checkout, invoice });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
