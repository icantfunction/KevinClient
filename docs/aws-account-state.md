<!-- Stage 11.5 Documentation Purpose -->
# AWS Account State

Last updated: `2026-04-19T19:43:41-04:00`

This document records the live AWS account state for Stage 11.5 hardening work. It is intentionally factual and operational. When a support request is filed or a manual console step is completed, update this file immediately.

## Account identity

- Account ID: `279630655712`
- CLI principal used for inspection: `arn:aws:iam::279630655712:user/david`
- Primary AWS Region for the Studio OS deployment: `us-east-1`

## Ticket 0.1 status

Status: `in_progress`

Current state observed on `2026-04-19`:

- Amazon SNS SMS sandbox status in `us-east-1`: `IsInSandbox=true`
- AWS End User Messaging SMS account tier in `us-east-1`: `SANDBOX`
- SNS `DefaultSMSType`: `Transactional`
- SNS monthly spend limit: `1 USD`
- Verified SNS sandbox destination numbers: `0`
- SMS origination identities in `us-east-1`: `0`
- SMS pools in `us-east-1`: `0`
- SMS registration attachments in `us-east-1`: `0`
- Cognito user pool: `us-east-1_jXkMyElVh`
- Cognito user pool client: `2i2e3m4e3e7trt94mnv8ck0u63`
- Seeded Cognito phone user exists for `+19548541484`

Observed blocker when attempting sandbox verification:

- `aws sns create-sms-sandbox-phone-number --phone-number +19548541484 --language-code en-US`
- Result: `UserError: No origination entities available to send`

Interpretation:

- The account cannot send even sandbox verification OTPs to Kevin's U.S. phone number until an SMS origination identity exists in `us-east-1`.
- Exiting the sandbox and increasing the SMS spend threshold still require an AWS Support Center request.
- The AWS Support API is not available to this account from the CLI because the account does not have a Premium Support subscription for the Support API. Manual Support Center submission is required.

## Required support-case payload

Use this exact request text for the SNS SMS production-access request in `us-east-1`:

> Single-user phone-based OTP authentication for a private photography studio management application. Expected volume under 200 SMS/month. Recipients are the account owner (+19548541484) for authentication, plus consenting studio rental customers receiving access codes and appointment reminders. Opt-in captured at booking; opt-out via STOP keyword. Transactional use only, no marketing.

Required asks in the same request:

- Exit SMS sandbox in `us-east-1`
- Raise monthly SMS spend threshold from `1 USD` to `20 USD`
- Keep message type as transactional

Suggested AWS Support form values:

- Service: `SNS Text Messaging` or `AWS End User Messaging SMS`, whichever the console currently exposes
- Region: `us-east-1`
- Message type: `Transactional`
- Countries: `United States`
- Website or app name: `Kevin's Studio OS`
- Opt-in description: `Kevin authenticates to his own admin app by entering his phone number. Studio renters consent at booking to receive access codes and reminder texts.`
- Sample OTP template: `Kevin's Studio OS code: {{####}}. Expires in 5 minutes.`
- Sample access-code template: `Kevin's Studio OS access code for your booking is {{######}}. Valid from 30 minutes before start until 30 minutes after end. Reply STOP to opt out.`

## Required manual console actions for Ticket 0.1

These are the next actions needed to make Kevin's phone work today.

1. Request a U.S.-capable SMS origination identity in `us-east-1`.
2. After that identity is active, initiate sandbox verification for `+19548541484`.
3. Kevin reads the received verification OTP from his phone.
4. Complete sandbox verification for `+19548541484`.
5. File the SNS production-access and spend-threshold support request with the payload above.
6. After approval, confirm the spend threshold is `20 USD` and `DefaultSMSType=Transactional` still holds.
7. Kevin signs into the admin PWA on his real iPhone and records the proof.

## CLI checkpoints after manual actions

After an origination identity exists:

```bash
aws sns create-sms-sandbox-phone-number --phone-number +19548541484 --language-code en-US
```

After Kevin receives the verification code:

```bash
aws sns verify-sms-sandbox-phone-number --phone-number +19548541484 --one-time-password <code>
```

To confirm verification:

```bash
aws sns list-sms-sandbox-phone-numbers
```

To confirm sandbox exit:

```bash
aws sns get-sms-sandbox-account-status
aws pinpoint-sms-voice-v2 describe-account-attributes --region us-east-1
```

To confirm the spend threshold and message type:

```bash
aws sns get-sms-attributes --attributes DefaultSMSType MonthlySpendLimit
```

## Kevin device-validation target

Admin API base URL:

- `https://2bb3ndmvqf.execute-api.us-east-1.amazonaws.com/`

Health endpoint:

- `https://2bb3ndmvqf.execute-api.us-east-1.amazonaws.com/health`

Target validation outcome for Ticket 0.1:

- Kevin receives a real SMS OTP at `+19548541484`
- Kevin completes the Cognito custom-auth flow on his real iPhone
- Kevin sees the admin dashboard without developer console or CLI intervention
- Screen capture is stored under [docs/proofs/stage-11-5/kevin-first-login](C:/Users/dramo/KevinClient/docs/proofs/stage-11-5/kevin-first-login/README.md)

## To be filled after completion

- SNS support case number: `pending`
- Support request submitted at: `pending`
- Support approval date: `pending`
- Effective spend cap after approval: `pending`
- Origination identity type and ARN: `pending`
- Kevin sandbox verification completed at: `pending`
- Kevin first real iPhone login completed at: `pending`

## Ticket 0.2 status

Status: `in_progress`

Current state observed on `2026-04-19`:

- SES production access in `us-east-1`: `enabled`
- SES sending enabled: `true`
- SES review case ID on the account: `176196142500258`
- Existing verified identities in the account are unrelated to Kevin's Studio OS
- Studio OS sender email environment value is still unset in deployed lambdas: `STUDIO_OS_SES_FROM_EMAIL=""`
- Studio OS configuration set now exists: `studio-os-outbound`

Relevant existing SES identities in the account:

- `lenisham.co` `DOMAIN` `SUCCESS`
- `pimanlakay.co` `DOMAIN` `SUCCESS`
- `david@scalehaus.org` `EMAIL_ADDRESS` `SUCCESS`

Important constraint:

- None of the currently verified identities are Kevin-owned sender identities for Studio OS, so they should not be treated as the go-live sender for this system.

Stage 11.5 wiring completed on `2026-04-19`:

- Added Studio OS configuration set `studio-os-outbound`
- Added SES event destination fanout: SES -> SNS -> SQS -> `SesEventLoggerFunction`
- Added email tagging on outbound Studio OS sends so SES delivery, bounce, complaint, open, and click events can be attached back to client timeline Activity rows
- Added receipt-email path for successful Stripe payment webhooks

Remaining manual steps:

1. Kevin chooses the sender domain or subdomain for Studio OS.
2. Verify that identity in SES `us-east-1`.
3. Set `STUDIO_OS_SES_FROM_EMAIL` to the verified sender address and redeploy.
4. If Kevin wants branded click tracking, configure a custom tracking redirect domain later. The current configuration set can still emit open/click events using SES defaults.

To verify current Studio OS configuration set:

```bash
aws sesv2 list-configuration-sets --region us-east-1
```

To inspect identities:

```bash
aws sesv2 list-email-identities --region us-east-1
```

## Ticket 0.3 status

Status: `in_progress`

Current state observed on `2026-04-19`:

- `studio-os/stripe/test`: missing
- `studio-os/stripe/live`: missing
- Deployed Stripe webhook URL: `https://2bb3ndmvqf.execute-api.us-east-1.amazonaws.com/webhooks/stripe`
- Provider status without secrets: unavailable, with explicit configuration error surfaced by the API

Stage 11.5 wiring completed on `2026-04-19`:

- Successful-payment webhook path now issues a receipt email through the Studio OS outbound email helper
- Stripe setup and smoke procedure documented in [stripe-runbook.md](C:/Users/dramo/KevinClient/docs/stripe-runbook.md:1)

Remaining manual steps:

1. Kevin creates or confirms the Stripe account to use.
2. Populate `studio-os/stripe/test`.
3. Register the deployed webhook endpoint in Stripe and copy its `whsec_...` signing secret into the AWS secret.
4. Run the Stage 0.3 test-mode smoke.
5. After test mode is proven, populate `studio-os/stripe/live`.

To confirm secret absence or presence:

```bash
aws secretsmanager describe-secret --secret-id studio-os/stripe/test
aws secretsmanager describe-secret --secret-id studio-os/stripe/live
```
