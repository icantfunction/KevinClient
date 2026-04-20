// Stage 11 Public Smart File Payment Intent Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";
import { createPaymentProvider } from "../shared/payments";
import { verifySmartFilePublicToken } from "../shared/smart-file-public-token";
import { listPayableInvoicesForSmartFile } from "../shared/smart-file-payments";

type CreateSmartFilePaymentIntentRequest = {
  readonly invoiceId?: string | null;
  readonly amountCents?: number | null;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const token = event.pathParameters?.token;
  if (!token) {
    return jsonResponse(400, { error: "Smart File token is required." });
  }

  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/sign/${token}/payment-intent:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  let smartFileId: string;
  try {
    const verified = await verifySmartFilePublicToken(token);
    smartFileId = verified.smartFileId;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(401, { error: error instanceof Error ? error.message : "Invalid Smart File token." });
  }

  try {
    const payload = event.body ? parseJsonBody<CreateSmartFilePaymentIntentRequest>(event) : {};
    const { clientsService, invoicesService, sessionsService, smartFilesService } = createStage3Services();
    const smartFile = await smartFilesService.getSmartFileById(smartFileId);
    if (!smartFile) {
      await abandonIdempotentRequest(idempotencyKey);
      return jsonResponse(404, { error: "smart file not found." });
    }

    const payableInvoices = await listPayableInvoicesForSmartFile({
      smartFileId,
      smartFilesService,
      invoicesService,
      sessionsService,
    });

    const selectedInvoice =
      (payload.invoiceId ? payableInvoices.find((invoice) => invoice.id === payload.invoiceId) : null) ?? payableInvoices[0];
    if (!selectedInvoice) {
      await abandonIdempotentRequest(idempotencyKey);
      return jsonResponse(404, { error: "No payable invoice is attached to this Smart File." });
    }

    const client = selectedInvoice.clientId ? await clientsService.getClientById(selectedInvoice.clientId) : null;
    const provider = await createPaymentProvider();
    const configuration = await provider.getConfiguration();
    if (!configuration.available) {
      await abandonIdempotentRequest(idempotencyKey);
      return jsonResponse(503, { error: configuration.reason ?? "Stripe is not configured." });
    }

    const checkout = await provider.createInvoiceCheckout({
      invoice: selectedInvoice,
      amountCents: payload.amountCents ?? null,
      smartFileId,
      customerEmail: smartFile.recipientEmail ?? client?.email ?? null,
      customerName: client?.primaryName ?? null,
    });

    const response = jsonResponse(201, { checkout, invoice: selectedInvoice });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
