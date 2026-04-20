<!-- Stage 11.5 Documentation Purpose -->
# Stripe Runbook

This document captures the Stage `0.3` Stripe setup and validation path for Kevin's Studio OS.

## Current status

Status: `in_progress`

Implemented in the deployed backend:

- Stripe provider selection via `STUDIO_OS_STRIPE_MODE`
- test secret name default: `studio-os/stripe/test`
- live secret name default: `studio-os/stripe/live`
- checkout endpoint: `POST /invoices/{id}/checkout`
- public Smart File payment-intent endpoint: `POST /sign/{token}/payment-intent`
- webhook endpoint: `POST /webhooks/stripe`
- refund endpoint: `POST /payments/{id}/refund`
- receipt-email path on successful payment webhook

Current blocker:

- Neither `studio-os/stripe/test` nor `studio-os/stripe/live` exists in AWS Secrets Manager in this account yet.

## Deployed webhook URL

- `https://2bb3ndmvqf.execute-api.us-east-1.amazonaws.com/webhooks/stripe`

## Secrets Manager payload shape

Create the test secret first:

- Secret name: `studio-os/stripe/test`

JSON payload:

```json
{
  "publishableKey": "pk_test_xxx",
  "secretKey": "sk_test_xxx",
  "webhookSecret": "whsec_xxx"
}
```

After test mode is fully proven, create:

- Secret name: `studio-os/stripe/live`

JSON payload:

```json
{
  "publishableKey": "pk_live_xxx",
  "secretKey": "sk_live_xxx",
  "webhookSecret": "whsec_xxx"
}
```

The provider also accepts snake_case variants, but use camelCase consistently.

## Stripe dashboard setup

1. In Stripe test mode, create or reuse Kevin's Stripe account.
2. Copy the test publishable key and secret key into `studio-os/stripe/test`.
3. In Workbench or Webhooks, create a webhook endpoint pointing to:
   - `https://2bb3ndmvqf.execute-api.us-east-1.amazonaws.com/webhooks/stripe`
4. Subscribe the endpoint to at least:
   - `payment_intent.succeeded`
   - `payment_intent.processing`
   - `payment_intent.payment_failed`
   - `refund.created`
   - `refund.updated`
   - `charge.refunded`
   - `charge.dispute.created`
   - `charge.dispute.closed`
   - `customer.created`
   - `customer.updated`
5. Copy the generated signing secret into `webhookSecret` in the matching AWS secret.

## Test cards

Use Stripe test mode only.

Common test numbers:

- Success: `4242 4242 4242 4242`
- 3DS success: `4000 0000 0000 3220`
- Decline: `4000 0000 0000 9995`
- Fraud dispute simulation: `4000 0000 0000 0259`

Use:

- any valid future expiry date
- any 3-digit CVC for Visa/Mastercard
- any valid postal code

Official references:

- https://docs.stripe.com/testing
- https://docs.stripe.com/webhooks/configure

## Stage 0.3 smoke procedure

1. Populate `studio-os/stripe/test`.
2. Confirm provider status:

```bash
aws secretsmanager describe-secret --secret-id studio-os/stripe/test
```

3. Log into the admin PWA as Kevin.
4. Create a test client and a test invoice with a small amount, such as `$1.00`.
5. Create or use a Smart File with an invoice/payment block tied to that invoice.
6. Open the Smart File public payment page and pay with `4242 4242 4242 4242`.
7. Confirm:
   - Stripe authorizes the payment
   - webhook hits `/webhooks/stripe`
   - a payment row is created
   - the invoice moves to `paid`
   - a receipt email is sent
   - timeline activity includes the outbound email and SES delivery/open/click events
8. From the admin, trigger a refund on that payment.
9. Confirm:
   - Stripe creates the refund
   - refund webhook is processed
   - refund payment row is created
   - invoice balance and refund totals reconcile
   - client receives refund email

## Rotation procedure

When rotating a webhook secret:

1. In Stripe dashboard, roll the endpoint signing secret for the deployed endpoint.
2. Immediately update the matching AWS secret:
   - `studio-os/stripe/test` for test mode
   - `studio-os/stripe/live` for live mode
3. Re-run a webhook smoke event to confirm signature verification still succeeds.

When rotating API keys:

1. Generate the replacement publishable and secret keys in Stripe.
2. Update the matching AWS secret JSON.
3. Re-run:
   - provider config check
   - checkout creation
   - test payment
   - refund smoke

## Live-mode checklist

Before populating `studio-os/stripe/live`:

- Test-mode payment flow passes end to end
- Test-mode refund flow passes end to end
- Receipt email path verified
- Webhook signature verification verified
- Kevin confirms dashboard reconciliation matches Stripe dashboard
- Any deploy-time mode flag points intentionally to `live`
- `studio-os/stripe/test` remains intact for future non-production testing
