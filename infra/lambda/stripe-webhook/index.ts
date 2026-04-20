// Stage 11 Stripe Webhook Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";
import { StripeProvider } from "../shared/payments/stripe-provider";
import { sendSmartFileEmail } from "../shared/smart-file-email";

export const handler = async (event: APIGatewayProxyEventV2) => {
  try {
    const provider = new StripeProvider();
    const configuration = await provider.getConfiguration();
    if (!configuration.available) {
      return jsonResponse(503, {
        error: configuration.reason ?? "Stripe is not configured.",
        result: {
          handled: false,
          provider: configuration.provider,
          eventType: "configuration.missing",
          reason: configuration.reason ?? "Stripe is not configured.",
        },
      });
    }

    const { activitiesService, clientsService, invoicesService, paymentsService } = createStage3Services();
    const result = await provider.handleWebhook({
      payload: event.body ?? "",
      signatureHeader: event.headers["stripe-signature"] ?? event.headers["Stripe-Signature"] ?? null,
      invoicesService,
      paymentsService,
    });

    if (result.handled && result.eventType === "payment_intent.succeeded") {
      const invoiceId =
        typeof result.summary?.invoiceId === "string" && result.summary.invoiceId.length > 0
          ? result.summary.invoiceId
          : null;

      if (invoiceId) {
        const invoice = await invoicesService.getInvoiceById(invoiceId);
        if (invoice) {
          const client = await clientsService.getClientById(invoice.clientId);
          if (client?.email) {
            const occurredAt = new Date();
            const externalMessageId = `stripe-receipt:${String(result.summary?.paymentIntentId ?? invoice.id)}`;
            const existingActivity = await activitiesService.getActivityByExternalMessageId(externalMessageId);

            if (!existingActivity) {
              const delivery = await sendSmartFileEmail({
                recipientEmail: client.email,
                subject: "Your payment receipt from Kevin's Studio OS",
                textBody: [
                  `Payment received for invoice ${invoice.id.slice(0, 8)}.`,
                  `Amount: $${(invoice.totalCents / 100).toFixed(2)}`,
                  `Balance remaining: $${(invoice.balanceCents / 100).toFixed(2)}`,
                ].join("\n"),
                htmlBody: [
                  `<p>Payment received for invoice <strong>${invoice.id.slice(0, 8)}</strong>.</p>`,
                  `<p>Amount: <strong>$${(invoice.totalCents / 100).toFixed(2)}</strong></p>`,
                  `<p>Balance remaining: <strong>$${(invoice.balanceCents / 100).toFixed(2)}</strong></p>`,
                ].join(""),
                tags: {
                  clientId: client.id,
                  scopeType: "invoice",
                  scopeId: invoice.id,
                  activityType: "payment.receipt",
                  externalMessageId,
                },
              });

              await activitiesService.createActivity(
                {
                  clientId: client.id,
                  scopeType: "invoice",
                  scopeId: invoice.id,
                  channel: "email",
                  direction: "outbound",
                  activityType: "payment.receipt",
                  subject: "Your payment receipt from Kevin's Studio OS",
                  body: `Payment receipt issued for invoice ${invoice.id.slice(0, 8)}.`,
                  externalMessageId,
                  occurredAt,
                  metadata: {
                    deliveryStatus: delivery.deliveryStatus,
                    deliveryError: delivery.deliveryError,
                    sesMessageId: delivery.messageId,
                    configurationSetName: delivery.configurationSetName,
                    paymentIntentId: result.summary?.paymentIntentId ?? null,
                  },
                },
                {
                  actor: "system",
                  occurredAt,
                },
              );
            }
          }
        }
      }
    }

    return jsonResponse(200, { ok: true, result });
  } catch (error) {
    return jsonResponse(400, { error: error instanceof Error ? error.message : "Stripe webhook failed." });
  }
};
