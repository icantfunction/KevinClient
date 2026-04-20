// Stage 11 Payment Refund Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";
import { createPaymentProvider } from "../shared/payments";
import { sendSmartFileEmail } from "../shared/smart-file-email";

type RefundPaymentRequest = {
  readonly amountCents?: number | null;
  readonly reason?: string | null;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const paymentId = event.pathParameters?.id;
  if (!paymentId) {
    return jsonResponse(400, { error: "payment id is required." });
  }

  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/payments/${paymentId}/refund:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = event.body ? parseJsonBody<RefundPaymentRequest>(event) : {};
    const occurredAt = new Date();
    const { activitiesService, clientsService, invoicesService, paymentsService } = createStage3Services();
    const payment = await paymentsService.getPaymentById(paymentId);
    if (!payment) {
      await abandonIdempotentRequest(idempotencyKey);
      return jsonResponse(404, { error: "payment not found." });
    }

    const invoice = await invoicesService.getInvoiceById(payment.invoiceId);
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

    const refund = await provider.refundPayment({
      payment,
      amountCents: payload.amountCents ?? null,
      reason: payload.reason ?? null,
    });

    const existingRefund = await paymentsService.getPaymentByProviderTransactionId(refund.refundId);
    const refundPayment =
      existingRefund ??
      (await paymentsService.createRefundPayment(
        {
          invoiceId: invoice.id,
          amountCents: refund.amountCents,
          method: "stripe_refund",
          referenceNote: `Stripe refund ${refund.refundId}`,
          receivedAt: occurredAt,
          recordedBy: "kevin",
          providerTransactionId: refund.refundId,
          currencyCode: invoice.currencyCode,
          refundReason: payload.reason ?? null,
        },
        { actor: "kevin", occurredAt },
      ));

    await activitiesService.createActivity(
      {
        clientId: invoice.clientId,
        scopeType: "invoice",
        scopeId: invoice.id,
        channel: "system",
        direction: "outbound",
        activityType: "payment.refunded",
        subject: `Refund for invoice ${invoice.id.slice(0, 8)}`,
        body: `Refunded ${refund.amountCents} cents through Stripe.`,
        occurredAt,
        metadata: {
          paymentId: payment.id,
          refundId: refund.refundId,
          amountCents: refund.amountCents,
        },
      },
      { actor: "kevin", occurredAt },
    );

    if (client?.email) {
      await sendSmartFileEmail({
        recipientEmail: client.email,
        subject: "Your refund from Kevin's Studio OS",
        textBody: [
          `A refund of $${(refund.amountCents / 100).toFixed(2)} was issued for invoice ${invoice.id.slice(0, 8)}.`,
          payload.reason ? `Reason: ${payload.reason}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        htmlBody: [
          `<p>A refund of <strong>$${(refund.amountCents / 100).toFixed(2)}</strong> was issued for invoice <strong>${invoice.id.slice(0, 8)}</strong>.</p>`,
          payload.reason ? `<p>Reason: ${payload.reason}</p>` : null,
        ]
          .filter(Boolean)
          .join(""),
        tags: {
          clientId: client.id,
          scopeType: "invoice",
          scopeId: invoice.id,
          activityType: "payment.refunded",
          externalMessageId: `payment-refund-email:${refund.refundId}`,
        },
      });
    }

    const response = jsonResponse(200, { refund, refundPayment });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
