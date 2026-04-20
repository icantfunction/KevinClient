<!-- Stage 11.5 Documentation Purpose -->
# Restart Handoff

This file is the single restart point for the next session.

## Current baseline

- Repo: `KevinClient`
- Branch state pushed to `main`
- Latest pushed commit: `3c461d0` `feat(11.5): harden auth fallback and outbox delivery`
- Date of last verified work: `2026-04-20`

## What is live right now

- Temporary Kevin-only OTP override is deployed in Cognito auth Lambdas.
- For the allowlisted phone `+19548541484`, OTP `999999` currently works.
- The override was verified live with:
  - `AdminInitiateAuth`
  - `AdminRespondToAuthChallenge`
  - access token + refresh token returned successfully
- `event_outbox` migration `0010_stage_11_5_event_outbox.sql` is applied in Aurora.
- Shared database write paths now enqueue outbox events transactionally for most services.
- The scheduled outbox publisher Lambda is deployed in `studio-os-stage-1-events`.
- Outbox CloudWatch alarms are deployed:
  - stale unpublished rows
  - rows exceeding retry threshold
- Audit partition precreate scheduler is deployed.
- A live outbox smoke passed:
  - created inquiry
  - outbox row inserted
  - publisher marked `published_at`
  - `attempt_count` stayed `0`

## Important temporary behavior

- OTP `999999` is intentionally temporary.
- It only works for `+19548541484`.
- Remove it as soon as real SNS SMS delivery is working.

Files involved:

- [infra/lambda/create-auth-challenge/index.ts](C:/Users/dramo/KevinClient/infra/lambda/create-auth-challenge/index.ts:1)
- [infra/lambda/verify-auth-challenge/index.ts](C:/Users/dramo/KevinClient/infra/lambda/verify-auth-challenge/index.ts:1)
- [infra/lib/stacks/auth-stack.ts](C:/Users/dramo/KevinClient/infra/lib/stacks/auth-stack.ts:1)

## External blockers still not resolved

These need Kevin or AWS console actions. They are not code-only tasks.

### SNS / OTP

- SNS SMS is still sandboxed in `us-east-1`.
- Spend cap is still `1 USD`, not `20 USD`.
- `+19548541484` is not verified as a sandbox destination.
- There is no usable U.S. origination identity yet, which blocks real SMS sends.

Reference:

- [docs/aws-account-state.md](C:/Users/dramo/KevinClient/docs/aws-account-state.md:1)

### SES / email delivery

- SES production access is already granted.
- A real sender identity is still missing.
- `STUDIO_OS_SES_FROM_EMAIL` is still effectively unset for real use.
- No Kevin-owned sending domain has been verified and cut over yet.
- Inbound MX cutover to SES is still not done.

### Stripe

- `studio-os/stripe/test` secret is still missing.
- `studio-os/stripe/live` secret is still missing.
- No Stripe webhook has been configured in the Stripe dashboard.
- No real end-to-end payment or refund validation has been run yet.

Reference:

- [docs/stripe-runbook.md](C:/Users/dramo/KevinClient/docs/stripe-runbook.md:1)

## Best next coding tasks when work resumes

Work from this list in order unless an external blocker gets cleared first.

### 1. Finish Ticket 1.1 completely

Current state:

- Shared service-layer writes mostly use the outbox now.
- `studio-bookings` still has a raw SQL path outside the same transaction pattern.
- The synthetic interruption test has not been run yet.

Next actions:

- Move `packages/database/src/services/studio-bookings-service.ts` onto the outbox pattern as far as safely possible.
- Add a proof script for:
  - burst of writes
  - interrupted publisher
  - replay after restart
- Validate no duplicate downstream effects.

Files:

- [packages/database/src/services/studio-bookings-service.ts](C:/Users/dramo/KevinClient/packages/database/src/services/studio-bookings-service.ts:1)
- [packages/database/src/services/event-outbox-service.ts](C:/Users/dramo/KevinClient/packages/database/src/services/event-outbox-service.ts:1)
- [infra/lambda/events-outbox-publisher/index.ts](C:/Users/dramo/KevinClient/infra/lambda/events-outbox-publisher/index.ts:1)

### 2. Keep Ticket 1.2 in monitoring state

Current state:

- Scheduler is live.
- Fallback metric is live.
- The acceptance condition is time-based: 30 days with zero fallback warnings.

Next actions:

- Do not rewrite it immediately.
- Check logs/metrics for unexpected `audit.partition.fallback_created`.
- If fallback fires again, investigate before moving on.

### 3. Ticket 1.3 PDF generation to Fargate

This is the next substantial buildable hardening task.

Current state:

- PDF worker is still Lambda + `pdf-lib`.
- Final spec expects Fargate-based PDF generation.

Next actions:

- Add `pdf-generator` worker path using the Stage 6 media pattern.
- Add queue + task definition + image build path.
- Move signed-PDF generation off the Lambda path behind a flag.

### 4. Ticket 1.4 Worker images to ECR

This pairs naturally with 1.3.

Current state:

- Workers still rely on runtime bootstrap in some places.

Next actions:

- Build Dockerfiles for:
  - image processor
  - pdf generator
- Wire GitHub Actions OIDC -> ECR publish.

### 5. Ticket 1.5 API stack split

Current state:

- API stack is still large.
- Stack splitting is still outstanding.

Next actions:

- Split `studio-os-stage-1-api` into the planned domain stacks.
- Reintroduce log retention consistently after the split.

## Best non-coding tasks for Kevin to do before next session

If Kevin wants the next session to move faster, these are the highest-value actions:

1. File the SNS production-access request and try sandbox verification for `+19548541484`.
2. Decide and provide the SES sending domain.
3. Create the Stripe test secret and webhook in AWS + Stripe dashboard.

Without those three, major portions of Stage 11.5 remain only partially verifiable.

## Fast resume checklist for next session

Start with these in order:

1. Open [docs/restart-handoff.md](C:/Users/dramo/KevinClient/docs/restart-handoff.md:1)
2. Open [docs/stage-caveats.md](C:/Users/dramo/KevinClient/docs/stage-caveats.md:1)
3. Run `git status --short`
4. Confirm `main` includes commit `3c461d0`
5. Decide whether the session is:
   - external-account setup follow-up
   - Ticket `1.1` completion
   - Ticket `1.3` Fargate PDF work

## Quick proof commands worth rerunning if needed

### Verify temporary OTP still works

Use direct Cognito admin auth against:

- user pool: `us-east-1_jXkMyElVh`
- client id: `2i2e3m4e3e7trt94mnv8ck0u63`
- username: `+19548541484`
- answer: `999999`

### Rebuild packages

```powershell
pnpm.cmd --filter @studio-os/database build
pnpm.cmd --filter studio-os-infra build
```

### Deploy relevant stacks

```powershell
pnpm.cmd exec cdk -a "tsx bin/studio-os.ts" deploy studio-os-stage-1-auth --require-approval never
pnpm.cmd exec cdk -a "tsx bin/studio-os.ts" deploy studio-os-stage-1-media studio-os-stage-1-api studio-os-stage-1-events --require-approval never
```

## Documents to keep in sync

- [docs/restart-handoff.md](C:/Users/dramo/KevinClient/docs/restart-handoff.md:1)
- [docs/stage-caveats.md](C:/Users/dramo/KevinClient/docs/stage-caveats.md:1)
- [docs/aws-account-state.md](C:/Users/dramo/KevinClient/docs/aws-account-state.md:1)
- [docs/stripe-runbook.md](C:/Users/dramo/KevinClient/docs/stripe-runbook.md:1)

## Short version

If the next session needs the one-paragraph summary:

`main` is at `3c461d0`. Temporary OTP `999999` is deployed and verified for Kevin's phone. Outbox + audit partition hardening is deployed and one live outbox smoke passed. The biggest unresolved items are still external account setup for SNS, SES, and Stripe, plus remaining buildable hardening tasks led by finishing Ticket `1.1`, then moving PDF generation to Fargate in Ticket `1.3`.
