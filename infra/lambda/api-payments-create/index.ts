// Stage 8 Payments Create Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreatePaymentRequest = {
  readonly invoiceId?: string;
  readonly amountCents?: number;
  readonly method?: string;
  readonly referenceNote?: string | null;
  readonly receivedAt?: string | null;
  readonly recordedBy?: string | null;
  readonly pdfReceiptS3Key?: string | null;
  readonly providerTransactionId?: string | null;
  readonly currencyCode?: string;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/payments:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreatePaymentRequest>(event);
    if (!payload.invoiceId || !payload.method?.trim() || !Number.isFinite(payload.amountCents)) {
      return jsonResponse(400, { error: "invoiceId, amountCents, and method are required." });
    }

    const { paymentsService } = createStage3Services();
    const payment = await paymentsService.createPayment(
      {
        invoiceId: payload.invoiceId,
        amountCents: payload.amountCents ?? 0,
        method: payload.method.trim(),
        referenceNote: payload.referenceNote?.trim() || null,
        receivedAt: payload.receivedAt ? new Date(payload.receivedAt) : undefined,
        recordedBy: payload.recordedBy?.trim() || undefined,
        pdfReceiptS3Key: payload.pdfReceiptS3Key ?? null,
        providerTransactionId: payload.providerTransactionId ?? null,
        currencyCode: payload.currencyCode,
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    const response = jsonResponse(201, { payment });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
