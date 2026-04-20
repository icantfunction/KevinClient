// Stage 11 Manual Payment Provider Purpose
import type { PaymentProvider } from "./payment-provider";

const unsupported = (operation: string): never => {
  throw new Error(`ManualProvider does not support ${operation}.`);
};

export class ManualProvider implements PaymentProvider {
  public async getConfiguration() {
    return {
      provider: "manual" as const,
      available: false,
      mode: "test" as const,
      publishableKey: null,
      reason: "Stripe credentials are not configured.",
    };
  }

  public async createInvoiceCheckout(
    _input: Parameters<PaymentProvider["createInvoiceCheckout"]>[0],
  ): Promise<never> {
    return unsupported("online checkout");
  }

  public async refundPayment(_input: Parameters<PaymentProvider["refundPayment"]>[0]): Promise<never> {
    return unsupported("provider refunds");
  }

  public async handleWebhook() {
    return {
      handled: false as const,
      provider: "manual" as const,
      eventType: "unsupported",
      reason: "ManualProvider does not consume webhook events.",
    };
  }
}
