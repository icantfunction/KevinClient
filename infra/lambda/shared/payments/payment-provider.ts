// Stage 11 Payment Provider Interface Purpose
import type { InvoicesService, PaymentsService } from "@studio-os/database";

export type PaymentProviderName = "manual" | "stripe";
export type PaymentProviderMode = "test" | "live";

export type PaymentProviderConfiguration = {
  readonly provider: PaymentProviderName;
  readonly available: boolean;
  readonly mode: PaymentProviderMode;
  readonly publishableKey: string | null;
  readonly reason: string | null;
};

export type CreateInvoiceCheckoutInput = {
  readonly invoice: Awaited<ReturnType<InvoicesService["getInvoiceById"]>>;
  readonly amountCents?: number | null;
  readonly smartFileId?: string | null;
  readonly customerEmail?: string | null;
  readonly customerName?: string | null;
};

export type CreatedInvoiceCheckout = {
  readonly provider: PaymentProviderName;
  readonly mode: PaymentProviderMode;
  readonly publishableKey: string;
  readonly clientSecret: string;
  readonly paymentIntentId: string;
  readonly amountCents: number;
  readonly currencyCode: string;
};

export type RefundPaymentInput = {
  readonly payment: Awaited<ReturnType<PaymentsService["getPaymentById"]>>;
  readonly amountCents?: number | null;
  readonly reason?: string | null;
};

export type RefundedPaymentResult = {
  readonly provider: PaymentProviderName;
  readonly refundId: string;
  readonly amountCents: number;
  readonly status: string | null;
  readonly providerTransactionId: string;
};

export type PaymentWebhookResult =
  | {
      readonly handled: true;
      readonly provider: PaymentProviderName;
      readonly eventType: string;
      readonly summary: Record<string, unknown>;
    }
  | {
      readonly handled: false;
      readonly provider: PaymentProviderName;
      readonly eventType: string;
      readonly reason: string;
    };

export interface PaymentProvider {
  getConfiguration(): Promise<PaymentProviderConfiguration>;
  createInvoiceCheckout(input: CreateInvoiceCheckoutInput): Promise<CreatedInvoiceCheckout>;
  refundPayment(input: RefundPaymentInput): Promise<RefundedPaymentResult>;
  handleWebhook(input: {
    readonly payload: string;
    readonly signatureHeader?: string | null;
    readonly invoicesService: InvoicesService;
    readonly paymentsService: PaymentsService;
  }): Promise<PaymentWebhookResult>;
}
