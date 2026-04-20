// Stage 11 Stripe Payment Provider Purpose
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import Stripe from "stripe";
import type { PaymentProvider, PaymentProviderMode } from "./payment-provider";

type StripeSecretPayload = {
  readonly publishableKey?: string;
  readonly publishable_key?: string;
  readonly secretKey?: string;
  readonly secret_key?: string;
  readonly webhookSecret?: string;
  readonly webhook_secret?: string;
};

type ResolvedStripeSecret = {
  readonly publishableKey: string;
  readonly secretKey: string;
  readonly webhookSecret: string;
};

const secretsManager = new SecretsManagerClient({});
const configuredMode: PaymentProviderMode =
  (process.env.STUDIO_OS_STRIPE_MODE ?? "test").trim().toLowerCase() === "live" ? "live" : "test";
const defaultSecretNames = {
  test: process.env.STUDIO_OS_STRIPE_TEST_SECRET_NAME?.trim() || "studio-os/stripe/test",
  live: process.env.STUDIO_OS_STRIPE_LIVE_SECRET_NAME?.trim() || "studio-os/stripe/live",
} as const;

let cachedSecret: Promise<ResolvedStripeSecret | null> | null = null;
let cachedClient: Promise<Stripe | null> | null = null;

const loadSecret = async (): Promise<ResolvedStripeSecret | null> => {
  try {
    const response = await secretsManager.send(
      new GetSecretValueCommand({
        SecretId: defaultSecretNames[configuredMode],
      }),
    );

    if (!response.SecretString) {
      return null;
    }

    const parsed = JSON.parse(response.SecretString) as StripeSecretPayload;
    const publishableKey = parsed.publishableKey ?? parsed.publishable_key ?? "";
    const secretKey = parsed.secretKey ?? parsed.secret_key ?? "";
    const webhookSecret = parsed.webhookSecret ?? parsed.webhook_secret ?? "";
    if (!publishableKey || !secretKey || !webhookSecret) {
      return null;
    }

    return {
      publishableKey,
      secretKey,
      webhookSecret,
    };
  } catch {
    return null;
  }
};

const getSecret = async () => {
  cachedSecret ??= loadSecret();
  return cachedSecret;
};

const getStripeClient = async () => {
  cachedClient ??= (async () => {
    const secret = await getSecret();
    return secret ? new Stripe(secret.secretKey) : null;
  })();

  return cachedClient;
};

export class StripeProvider implements PaymentProvider {
  public async getConfiguration() {
    const secret = await getSecret();
    return {
      provider: "stripe" as const,
      available: Boolean(secret),
      mode: configuredMode,
      publishableKey: secret?.publishableKey ?? null,
      reason: secret ? null : `Missing or incomplete Stripe secret ${defaultSecretNames[configuredMode]}.`,
    };
  }

  public async createInvoiceCheckout(input: Parameters<PaymentProvider["createInvoiceCheckout"]>[0]) {
    const stripe = await getStripeClient();
    const secret = await getSecret();
    if (!stripe || !secret) {
      throw new Error(`Stripe is not configured. Expected secret ${defaultSecretNames[configuredMode]}.`);
    }

    if (!input.invoice) {
      throw new Error("Invoice is required for Stripe checkout.");
    }

    const invoice = input.invoice;
    const amountCents = Math.max(
      1,
      Math.min(
        input.amountCents ?? invoice.balanceCents,
        invoice.balanceCents > 0 ? invoice.balanceCents : invoice.totalCents,
      ),
    );

    const intent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: invoice.currencyCode.toLowerCase(),
      automatic_payment_methods: {
        enabled: true,
      },
      receipt_email: input.customerEmail ?? undefined,
      description: `Kevin Studio OS invoice ${invoice.id}`,
      metadata: {
        invoiceId: invoice.id,
        smartFileId: input.smartFileId ?? "",
        sourceType: invoice.sourceType,
        sourceId: invoice.sourceId ?? "",
        customerName: input.customerName ?? "",
      },
    });

    if (!intent.client_secret) {
      throw new Error(`Stripe PaymentIntent ${intent.id} did not return a client secret.`);
    }

    return {
      provider: "stripe" as const,
      mode: configuredMode,
      publishableKey: secret.publishableKey,
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amountCents,
      currencyCode: invoice.currencyCode,
    };
  }

  public async refundPayment(input: Parameters<PaymentProvider["refundPayment"]>[0]) {
    const stripe = await getStripeClient();
    if (!stripe) {
      throw new Error(`Stripe is not configured. Expected secret ${defaultSecretNames[configuredMode]}.`);
    }

    if (!input.payment?.providerTransactionId) {
      throw new Error("The selected payment does not have a Stripe transaction id.");
    }

    const paymentAmountCents = Math.max(input.payment.amountCents, 0);
    const amountCents = Math.max(1, Math.min(input.amountCents ?? paymentAmountCents, paymentAmountCents));
    const refund = await stripe.refunds.create({
      payment_intent: input.payment.providerTransactionId,
      amount: amountCents,
      reason: input.reason === "fraudulent" || input.reason === "requested_by_customer" || input.reason === "duplicate"
        ? input.reason
        : undefined,
      metadata: {
        invoiceId: input.payment.invoiceId,
        paymentId: input.payment.id,
      },
    });

    return {
      provider: "stripe" as const,
      refundId: refund.id,
      amountCents,
      status: refund.status ?? null,
      providerTransactionId: input.payment.providerTransactionId,
    };
  }

  public async handleWebhook(input: Parameters<PaymentProvider["handleWebhook"]>[0]) {
    const stripe = await getStripeClient();
    const secret = await getSecret();
    if (!stripe || !secret) {
      return {
        handled: false as const,
        provider: "stripe" as const,
        eventType: "configuration.missing",
        reason: `Stripe is not configured. Expected secret ${defaultSecretNames[configuredMode]}.`,
      };
    }

    if (!input.signatureHeader) {
      throw new Error("Missing Stripe-Signature header.");
    }

    const event = stripe.webhooks.constructEvent(input.payload, input.signatureHeader, secret.webhookSecret);

    if (event.type === "payment_intent.succeeded") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const invoiceId = paymentIntent.metadata?.invoiceId;
      if (!invoiceId) {
        return {
          handled: false as const,
          provider: "stripe" as const,
          eventType: event.type,
          reason: "PaymentIntent metadata did not include invoiceId.",
        };
      }

      const existingPayment = await input.paymentsService.getPaymentByProviderTransactionId(paymentIntent.id);
      if (existingPayment) {
        return {
          handled: true as const,
          provider: "stripe" as const,
          eventType: event.type,
          summary: {
            paymentIntentId: paymentIntent.id,
            paymentId: existingPayment.id,
            invoiceId,
            deduplicated: true,
          },
        };
      }

      const payment = await input.paymentsService.createPayment(
        {
          invoiceId,
          amountCents: paymentIntent.amount_received || paymentIntent.amount,
          method: "stripe",
          referenceNote: `Stripe PaymentIntent ${paymentIntent.id}`,
          receivedAt: new Date((paymentIntent.created ?? Math.floor(Date.now() / 1000)) * 1000),
          recordedBy: "system",
          providerTransactionId: paymentIntent.id,
          currencyCode: (paymentIntent.currency ?? "usd").toUpperCase(),
        },
        {
          actor: "system",
          occurredAt: new Date(),
        },
      );

      await input.invoicesService.updateInvoice(
        invoiceId,
        {
          paymentProviderId: paymentIntent.customer ? String(paymentIntent.customer) : paymentIntent.id,
          paymentMethodNote: `Stripe:${paymentIntent.id}`,
        },
        { actor: "system", occurredAt: new Date() },
      );

      return {
        handled: true as const,
        provider: "stripe" as const,
        eventType: event.type,
        summary: {
          paymentIntentId: paymentIntent.id,
          paymentId: payment.id,
          invoiceId,
          amountReceived: paymentIntent.amount_received || paymentIntent.amount,
        },
      };
    }

    if (event.type === "refund.created" || event.type === "refund.updated") {
      const refund = event.data.object as Stripe.Refund;
      if (refund.status !== "succeeded") {
        return {
          handled: false as const,
          provider: "stripe" as const,
          eventType: event.type,
          reason: `Refund status ${refund.status ?? "unknown"} is not final.`,
        };
      }

      const existingRefund = await input.paymentsService.getPaymentByProviderTransactionId(refund.id);
      if (existingRefund) {
        return {
          handled: true as const,
          provider: "stripe" as const,
          eventType: event.type,
          summary: {
            refundId: refund.id,
            paymentId: existingRefund.id,
            deduplicated: true,
          },
        };
      }

      const paymentIntentId =
        typeof refund.payment_intent === "string" ? refund.payment_intent : refund.payment_intent?.id ?? null;
      if (!paymentIntentId) {
        return {
          handled: false as const,
          provider: "stripe" as const,
          eventType: event.type,
          reason: "Refund did not reference a payment_intent.",
        };
      }

      const originalPayment = await input.paymentsService.getPaymentByProviderTransactionId(paymentIntentId);
      if (!originalPayment) {
        return {
          handled: false as const,
          provider: "stripe" as const,
          eventType: event.type,
          reason: `No original payment row found for PaymentIntent ${paymentIntentId}.`,
        };
      }

      const refundPayment = await input.paymentsService.createRefundPayment(
        {
          invoiceId: originalPayment.invoiceId,
          amountCents: refund.amount,
          method: "stripe_refund",
          referenceNote: `Stripe refund ${refund.id}`,
          receivedAt: new Date((refund.created ?? Math.floor(Date.now() / 1000)) * 1000),
          recordedBy: "system",
          providerTransactionId: refund.id,
          currencyCode: (refund.currency ?? "usd").toUpperCase(),
          refundReason: refund.reason ?? null,
        },
        {
          actor: "system",
          occurredAt: new Date(),
        },
      );

      return {
        handled: true as const,
        provider: "stripe" as const,
        eventType: event.type,
        summary: {
          refundId: refund.id,
          paymentId: refundPayment.id,
          originalPaymentId: originalPayment.id,
          invoiceId: originalPayment.invoiceId,
          amountRefunded: refund.amount,
        },
      };
    }

    return {
      handled: false as const,
      provider: "stripe" as const,
      eventType: event.type,
      reason: "Event type is not mapped by the Stage 11 handler.",
    };
  }
}
