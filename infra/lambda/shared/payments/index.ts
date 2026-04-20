// Stage 11 Payment Provider Resolver Purpose
import { ManualProvider } from "./manual-provider";
import type { PaymentProvider } from "./payment-provider";
import { StripeProvider } from "./stripe-provider";

export * from "./payment-provider";

export const createPaymentProvider = async (): Promise<PaymentProvider> => {
  const stripeProvider = new StripeProvider();
  const config = await stripeProvider.getConfiguration();
  if (config.available) {
    return stripeProvider;
  }

  return new ManualProvider();
};
