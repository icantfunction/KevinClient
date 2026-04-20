// Stage 8 Invoices Create Lambda Purpose
import { invoiceSourceTypes, invoiceStatuses } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreateInvoiceRequest = {
  readonly clientId?: string;
  readonly sourceType?: string;
  readonly sourceId?: string | null;
  readonly lineItems?: Array<Record<string, unknown>>;
  readonly subtotalCents?: number;
  readonly taxCents?: number;
  readonly discountCents?: number;
  readonly totalCents?: number;
  readonly paidCents?: number;
  readonly balanceCents?: number;
  readonly status?: string;
  readonly sentAt?: string | null;
  readonly dueAt?: string | null;
  readonly paidAt?: string | null;
  readonly paymentMethodNote?: string | null;
  readonly refundAmountCents?: number;
  readonly refundReason?: string | null;
  readonly pdfS3Key?: string | null;
  readonly paymentProviderId?: string | null;
  readonly currencyCode?: string;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/invoices:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateInvoiceRequest>(event);
    if (!payload.clientId || !payload.sourceType || !invoiceSourceTypes.includes(payload.sourceType as never)) {
      return jsonResponse(400, { error: "clientId and a valid sourceType are required." });
    }

    if (payload.status && !invoiceStatuses.includes(payload.status as never)) {
      return jsonResponse(400, { error: "status is invalid." });
    }

    const { invoicesService } = createStage3Services();
    const invoice = await invoicesService.createInvoice(
      {
        clientId: payload.clientId,
        sourceType: payload.sourceType as (typeof invoiceSourceTypes)[number],
        sourceId: payload.sourceId ?? null,
        lineItems: payload.lineItems ?? [],
        subtotalCents: payload.subtotalCents,
        taxCents: payload.taxCents,
        discountCents: payload.discountCents,
        totalCents: payload.totalCents,
        paidCents: payload.paidCents,
        balanceCents: payload.balanceCents,
        status: payload.status as (typeof invoiceStatuses)[number] | undefined,
        sentAt: payload.sentAt ? new Date(payload.sentAt) : null,
        dueAt: payload.dueAt ? new Date(payload.dueAt) : null,
        paidAt: payload.paidAt ? new Date(payload.paidAt) : null,
        paymentMethodNote: payload.paymentMethodNote?.trim() || null,
        refundAmountCents: payload.refundAmountCents,
        refundReason: payload.refundReason?.trim() || null,
        pdfS3Key: payload.pdfS3Key ?? null,
        paymentProviderId: payload.paymentProviderId ?? null,
        currencyCode: payload.currencyCode,
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    const response = jsonResponse(201, { invoice });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
