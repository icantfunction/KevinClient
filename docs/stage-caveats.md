<!-- Stage 3 Documentation Purpose -->
# Stage Caveats

## Stage 11.5 hardening tracker

- Ticket `0.1` `in_progress` on `2026-04-19`: inspected the live SNS/Cognito account state, confirmed SNS is still sandboxed with a `1 USD` spend cap, confirmed there are zero verified sandbox destination numbers, and identified a new operational blocker for U.S. delivery: there is no SMS origination identity in `us-east-1`, so AWS returns `UserError: No origination entities available to send` when attempting to verify `+19548541484`. Added [aws-account-state.md](C:/Users/dramo/KevinClient/docs/aws-account-state.md:1) with the exact support-case payload, current account facts, and the CLI checkpoints Kevin must run after console actions.
Residual risk:
- Ticket `0.1` is not closed yet. Kevin still cannot receive a real OTP until an origination identity exists and the sandbox verification is completed on his phone. Sandbox exit and the spend-cap increase also still require a manual Support Center submission because the AWS Support API is unavailable to this account from the CLI.
- Ticket `0.2` `in_progress` on `2026-04-19`: confirmed SES production access is already granted in `us-east-1`, so the account-level sandbox/prod-access blocker is no longer the issue here. Added a Studio OS outbound configuration set `studio-os-outbound`, SES event fanout `SES -> SNS -> SQS -> SesEventLoggerFunction`, and outbound email tagging so send, delivery, bounce, complaint, open, and click events can become Activity rows. Also patched Studio OS outbound email helpers to use the configuration set and HTML bodies so open/click tracking can exist once a real sender identity is configured.
Residual risk:
- Ticket `0.2` is not closed yet. Kevin still has no verified Studio OS sender identity configured, `STUDIO_OS_SES_FROM_EMAIL` is still empty in deployed lambdas, and no Kevin-owned domain has been cut over for outbound mail.
- Ticket `0.3` `in_progress` on `2026-04-19`: confirmed `studio-os/stripe/test` and `studio-os/stripe/live` are still missing, so the Stripe path remains commercially inert. Added [stripe-runbook.md](C:/Users/dramo/KevinClient/docs/stripe-runbook.md:1) with the exact secret JSON shape, webhook URL, smoke procedure, test cards, and rotation procedure. Also patched the webhook success path to send a payment receipt email once Stripe secrets and SES sender configuration are present.
Residual risk:
- Ticket `0.3` is not closed yet. No Stripe secrets exist in AWS Secrets Manager, no Stripe webhook endpoint is registered in Kevin's Stripe dashboard yet, and no end-to-end payment or refund test has been run.
- Temporary auth override on `2026-04-19`: deployed a Kevin-only OTP fallback so the Cognito custom auth flow accepts `999999` for the allowlisted phone `+19548541484` even while SNS delivery remains blocked. Verified live against the deployed user pool by completing `AdminInitiateAuth -> AdminRespondToAuthChallenge` and receiving access plus refresh tokens without SMS.
Residual risk:
- This is intentionally temporary and weakens the OTP story until it is removed. It is limited to Kevin's single allowed phone number, but it must be deleted as soon as SNS production delivery is working.
- Ticket `1.1` `partial` on `2026-04-19`: added and migrated the `event_outbox` table, refactored the shared database mutation path so most service-layer writes now enqueue audit plus outbox artifacts transactionally, deployed the scheduled outbox publisher Lambda plus CloudWatch alarms, and reran a live smoke where a new inquiry created an outbox row that was later marked with `published_at` after publish.
Residual risk:
- Ticket `1.1` is not fully closed yet. The raw SQL studio-bookings path still uses the older post-write mutation path, EventBridge itself still cannot accept a caller-supplied top-level event ID so downstream idempotency relies on `detail.eventId`, and the 50-write interruption test has not been run yet.
- Ticket `1.2` `partial` on `2026-04-19`: added monthly audit partition precreation code, deployed the scheduled Lambda that creates the next two months' partitions, and added an EMF warning metric when a write path has to create a partition on demand. A Data API `regclass` edge case was fixed during rollout by casting `to_regclass(... )` to text before reading it.
Residual risk:
- Ticket `1.2` is not fully closed yet. The scheduler is live, but the "30 days with zero fallback warnings" acceptance window has not elapsed yet.

## Stage 1 caveats carried forward

- SNS SMS is still in sandbox in `us-east-1`.
- No sandbox phone numbers are verified yet, so real human receipt of the OTP SMS has not been validated on Kevin's device.
- The Cognito custom auth flow itself was verified end-to-end by issuing a challenge, deriving the stored OTP from the hashed record inside the AWS account, and exchanging it for access, ID, and refresh tokens.
- A temporary Kevin-only OTP override is currently active: `999999` will satisfy the Cognito challenge for `+19548541484` until it is explicitly removed.
- The AWS account-level SMS monthly spend limit is still `1 USD`.
- The desired `20 USD` spend cap cannot be applied until AWS approves higher SNS production SMS limits for this account.
- Stage 1 therefore set only `DefaultSMSType=Transactional` via SNS account attributes.

## Stage 2 caveats

- Aurora Serverless v2 is configured for low idle cost with `0 ACU` minimum capacity and Data API access. First request after pause will incur Aurora resume latency.
- Stage 2 uses Aurora PostgreSQL Data API access from outside the VPC. This avoids NAT Gateway cost, but query design must respect Data API limits and response-size constraints.
- Audit log partitioning is implemented as a partitioned table plus application-level partition creation before writes. There is not yet a background partition pre-creation job.
- Mutation publishing goes directly to the default EventBridge bus after database commit. There is not yet an outbox/replay mechanism if EventBridge publish fails after a successful write.

## Stage 3 caveats

- Stage 3 public inquiry intake, inquiry auto-response, and SES inbound parser are deployed and verified, but outbound SES delivery is still running without a verified sender identity because Kevin's real sending domain has not been configured in this AWS account yet.
- The SES receipt rule set scaffold is deployed as `studio-os-stage-1-inbound`, but real inbound cutover still requires Kevin's verified domain plus MX routing to SES.
- Kevin-only inbox and timeline routes are protected by the Cognito JWT authorizer, but live browser/device validation of the JWT flow is still blocked by the SNS SMS sandbox until Kevin's phone is verified or the account leaves sandbox mode.
- Aurora `0 ACU` pause/resume was observed during Stage 3 verification: the first migration/smoke call failed with `DatabaseResumingException`, then succeeded on retry once the cluster resumed.

## Stage 4 caveats

- Session task templates are implemented as code-defined catalogs and are not editable from an admin UI yet.
- Kevin-only Stage 4 routes are deployed behind the Cognito JWT authorizer, but end-to-end browser validation is still gated on the SNS SMS sandbox caveat from Stage 1.
- iCal feed tokens are implemented as signed JWTs backed by a Secrets Manager secret containing `{ signingKey, version }`. Revocation works by incrementing the secret version, which invalidates all previously issued feed URLs at once.
- The `.ics` feed currently includes sessions, task due dates, and inquiry event dates from the existing Stage 4 entities. Later stages will need to extend the feed once invoices, Smart Files, studio bookings, and other calendar-bearing entities exist.

## Stage 5 caveats

- Smart File template creation, instantiation, send, public view, SMS verification request, submit, and signed PDF generation are deployed and were proven against the live Stage 1 stack with `pnpm --filter studio-os-infra prove:stage5`.
- The proof script exercises the public verification endpoint, then seeds a deterministic verification code through a local-only helper before submit. This is a test seam for non-production verification and must not be exposed through the public API.
- SES delivery from Smart File send/PDF completion remains skipped until Kevin's sender identity is verified in SES for this AWS account.
- The current signed-PDF worker runs as an SQS-triggered Lambda using `pdf-lib`. That is good enough for Stage 5 proof, but it is not yet the Fargate-based PDF generation architecture called for by the final spec.
- Signature records store the typed/drawn method, signer metadata, and document hash, but they do not yet persist a rendered signature image object in S3 or IP-derived geolocation enrichment. `signature_image_s3_key` and `signer_geolocation` remain partial placeholders.
- Signed-PDF completion emails currently notify with the stored S3 object key in the body. They do not yet send the PDF as an email attachment or signed download link.

## Stage 6 caveats

- Stage 6 galleries, direct multipart upload, S3 to SQS ingest, ECS Fargate image processing, and public gallery links were proven live on `2026-04-18` with both a 5-photo smoke run and the 500-photo kill-criterion run.
- The 500-photo proof completed in `103976 ms` total with queue depth returning to zero and DLQ remaining zero. This passed the stated `< 30 minutes` requirement comfortably, but the proof used duplicated tiny PNG fixtures rather than wedding-scale RAW files.
- Public gallery delivery currently uses API Gateway routes plus signed gallery JWTs and S3 presigned asset URLs. The deployed CloudFront distribution exists, but gallery clients are not yet consuming CloudFront-signed URLs and the `/apps/gallery` frontend has not been built yet.
- The current public gallery page is a Lambda-rendered HTML document. It is functional for proof and sharing, but it is not yet the final React gallery application called for in `/apps/gallery`.
- Fargate image processing currently bootstraps `sharp`, `exifr`, and AWS SDK packages at task start from the public Node image because Docker image build/publish is not available in this local environment. That keeps the stage moving, but it adds startup latency and should be replaced with a built worker image later.
- The image pipeline proof currently exercised small fixture images. Before Kevin treats this as production-ready for weddings, the same pipeline should be rerun with heavier JPEG and RAW-like payloads to validate task storage, memory headroom, and throughput under more realistic file sizes.
- Gallery asset access is currently based on per-request presigned S3 URLs minted by Lambda. This is acceptable for Stage 6 proof, but later stages should move to CloudFront-signed delivery for better CDN caching and tighter long-lived sharing semantics.
- `recordPhotoProcessed` required an atomic database-side increment to avoid lost updates under concurrent EventBridge deliveries. That race is fixed in this branch and was validated by the 500-photo run, but it is an important concurrency assumption to preserve in later refactors.

## Stage 7 caveats

- Stage 7 studio spaces, equipment inventory, studio booking schema, booking overlap exclusion, access code issuance/verification, and public booking request intake are deployed. The live API stack now exposes the `/studio/*` routes.
- The public studio experience is currently a Lambda-rendered HTML page at `/studio/page`. The dedicated `/apps/studio` frontend is still deferred.
- Public booking requests currently create `studio_rental` inquiries with booking metadata attached. They do not yet instantiate the combined Smart File package for waiver plus invoice plus access instructions on their own.
- The studio booking overlap rule is enforced at the database level for booking-vs-booking conflicts on the same `space_id` via a GiST `EXCLUDE` constraint over a generated `tstzrange`. Kevin own-studio session conflicts are enforced in the application service layer during booking create/update.
- The own-studio session conflict rule currently blocks all spaces whenever a `uses_own_studio = true` photography session overlaps the requested booking window. If Kevin later needs per-space studio-session routing, the session model will need a more explicit studio-space reference.
- Equipment availability is maintained through database triggers that recompute `quantity_available` from active booking line items. That satisfies the Stage 7 requirement without a background worker, but later stages should monitor for write amplification if booking volume grows.
- The access-code verification endpoint is intentionally public to match the future smart-lock webhook shape. It logs every attempt, but it does not yet enforce a shared-secret handshake, WAF rule, or per-origin allowlist.
- Turnover task creation is currently attached to the booking update path when a booking status transitions into `completed`. There is not yet a background reconciliation job to backfill missed turnover tasks if a later automation fails.
- Stage 7 validation was run through the database smoke path after the migration and API deployment. It proved access-code issuance, valid access verification, same-space overlap rejection, own-studio session rejection, and completed booking updates. It did not yet run a separate live HTTP proof script against every new route.

## Stage 8 caveats

- Stage 8 invoices, payments, expenses, receipt-scan OCR intake, and reporting routes are deployed behind the Cognito JWT authorizer. Live HTTP proof currently confirms the API deployment shape through `401` responses on the protected Stage 8 routes, but not Kevin-authenticated browser usage, because the SNS SMS sandbox caveat from Stage 1 still applies.
- Receipt OCR is implemented with an S3 upload bucket plus S3 object-created notification into a Lambda that calls Textract `AnalyzeExpense` and updates the `expense_receipt_scans` row. The deployed worker path is in place, but a live authenticated upload from the admin app has not been exercised yet.
- Aurora Serverless v2 `0 ACU` pause/resume interrupted the first Stage 8 migration attempt with `DatabaseResumingException`. The migration and smoke scripts now retry automatically on that error, but the same first-hit latency remains user-visible on infrequently used admin/reporting endpoints unless a keep-alive is introduced later.
- Revenue and profit reports are based on stored invoice and payment rows, with outstanding balance grouped by invoice due/sent month. That is correct for the current manual-payment stage, but the eventual Stage 11 Stripe reconciliation path will need to preserve these accounting assumptions.
- Studio utilization currently estimates available hours from `availabilityRules.weeklySchedule` when present and falls back to a `12 hours/day` default when explicit rules are absent. That keeps the Stage 8 report useful now, but it should be tightened once Kevin's real studio availability data is seeded.
- The tax-year report intentionally returns `0` placeholders for mileage and home-office estimates because those source datasets do not exist yet in the backend.

## Stage 9 caveats

- Stage 9 automation coverage is implemented as code-defined Lambda workers plus EventBridge Scheduler schedules. There is not yet an admin-editable automation builder or a generalized sequence-definition engine.
- Sequence-driven Smart File sending is supported for already-instantiated Smart Files with `scheduledSendAt`, but the broader business rule of automatically choosing and instantiating the correct Smart File template for every session or studio event is still partial and will need refinement in later stages.
- Monthly financial automation currently emails Kevin a P&L snapshot on the first of the month, but recurring retainer invoice generation remains manual because there is not yet a recurring invoice model.
- NOAA severe-weather checks only run for sessions that have usable `locationCoords`. Sessions missing coordinates are intentionally skipped rather than guessed from free-text addresses.
- Access-code SMS and Kevin alert SMS activity are implemented through SNS-backed workers, but production-grade live delivery is still subject to the Stage 1 SNS sandbox and spend-cap caveats until AWS account settings are updated.
- Stage 9 verification was done by direct Lambda invocation against deployed AWS resources. End-to-end Kevin-authenticated dashboard execution is still deferred until the Stage 10 admin app and the SNS auth caveat are both addressed.

## Stage 10 caveats

- Stage 10 converted the existing repo-root Next.js app into the admin PWA rather than moving immediately to `/apps/admin`. This keeps momentum and respects the current repo layout, but a later frontend split is still desirable if the monorepo grows.
- The browser-side Cognito custom-auth flow is implemented and the protected Stage 10 routes are live, but real Kevin device validation is still limited by the Stage 1 SNS SMS sandbox caveat.
- Stage 10 added `/clients`, `/tasks`, `/search`, and `/time-entries` routes plus mobile shot-list and booking check-in pages. The live smoke on `2026-04-19` proved these via protected-route `401` checks and direct Lambda invocation against deployed AWS resources.
- Cross-region gallery-original backup restore was proven on `2026-04-19` by copying a replicated object from the `us-west-2` backup bucket back into the `us-east-1` originals bucket under `restore-drill/2026-04-19/`, then verifying matching SHA-256 hashes.
- The restore drill intentionally used a small Stage 6 proof image, not a large wedding RAW. It proves the replication and restore path, but not Glacier restore timing for older archived objects.
- To stay under CloudFormation's 500-resource stack limit, Stage 10 removed API-stack Lambda log-retention resources. API Lambda log groups therefore use default retention until the API stack is split or centralized log-group management is added.
- The `studio-os-stage-1-api` stack now synthesizes at roughly `448` resources. That is deployable today, but additional API surface should be accompanied by stack partitioning rather than continued growth in one stack.
- `KevinStudio/` remains on disk as local source material and is excluded from the root TypeScript build; `/studio` is the folded in-app representation for now.

## Stage 11 caveats

- Stage 11 introduces the payment-provider seam, Stripe-aware checkout/refund/webhook lambdas, and a public Smart File payment page, but live payment testing is currently blocked because the expected Secrets Manager entries `studio-os/stripe/test` and `studio-os/stripe/live` do not exist in this AWS account.
- The provider layer intentionally falls back to `ManualProvider` when the named Stripe secret is missing or incomplete. That keeps the rest of the system operational, but it also means checkout creation currently returns an explicit configuration error instead of producing a Stripe client secret.
- The new public Smart File payment page at `/sign/{token}/page` renders the embedded Stripe Payment Element scaffold and fetches payment intent data from the API. It improves the payment experience materially, but the broader fully polished `/apps/sign` React application is still not present in this repo.
- Stage 11 refund execution is implemented in the admin API and dashboard for Stripe-origin payments, with refund reconciliation also handled through the webhook path. Until live Stripe secrets exist, this remains code-complete but not payment-network-verified.
- Webhook reconciliation currently handles `payment_intent.succeeded` and `refund.created` or `refund.updated`. That covers the core Stage 11 payment and refund path, but dispute handling and broader event coverage remain later hardening work.
- The Stripe integration assumes the secret payload shape `{ publishableKey, secretKey, webhookSecret }`, while also accepting snake_case variants. Secret rotation and final account credential placement still need to be done in AWS Secrets Manager.

## Later operational follow-ups

- Request SNS production SMS access in `us-east-1`.
- Verify `+19548541484` in sandbox if production access is not approved yet.
- Raise SNS monthly spend limit to `20 USD` once AWS permits it.
- Verify and attach Kevin's SES sender identity.
- Point Kevin's receiving domain MX records to SES and activate the inbound mailbox cutover.
- Add an outbox/retry path for mutation event publishing before higher-volume automation stages.
- Add scheduled keep-alive only if Aurora resume latency becomes unacceptable for Kevin's dashboard.
- Replace the Stage 5 Lambda PDF worker with the planned Fargate PDF pipeline before large multi-page Smart Files are treated as production-ready.
- Decide whether to add a work-hours Aurora keep-alive schedule if Kevin finds first-open dashboard/report latency unacceptable at `0 ACU`.
- Exercise the authenticated receipt upload plus Textract OCR path from the eventual `/apps/admin` UI once Stage 10 dashboard work begins.
- Add deterministic template-selection rules before wiring fully automatic Smart File instantiation into more Stage 9 lifecycle events.
- Split the API stack before Stage 11 or any large post-Stage-10 API expansion so log retention can be reintroduced without brushing against the CloudFormation resource ceiling.
- Create and populate `studio-os/stripe/test` first, then `studio-os/stripe/live`, with `publishableKey`, `secretKey`, and `webhookSecret`, and then rerun the Stage 11 smoke against real Stripe test-mode objects.
