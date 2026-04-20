<!-- Stage 9 README Purpose -->
# Kevin's Studio OS

Single-backend system for Kevin's photography business and studio rental business, built inside the existing `KevinClient` repo.

## Current status

- Stage 0 complete: compatibility report and repo integration seam chosen
- Stage 1 complete: Cognito phone-only custom auth, OTP Lambdas, DynamoDB OTP storage, API health check, deployed in `us-east-1`
- Stage 2 complete: Aurora Serverless v2 + Data API, Drizzle schema, migrations, audit log, EventBridge publisher, and core shared services
- Stage 3 complete in this branch: inquiries, public inquiry intake API, inquiry auto-response worker, communications hub queries, protected inbox/timeline endpoints, and SES S3 -> SQS -> parser ingestion
- Stage 4 complete in this branch: sessions, shot lists, session task-template spawning, calendar views, dashboard summary, and signed iCal feed tokens with revocation
- Stage 5 complete in this branch: Smart File templates, Smart File instantiation/sending, public signing flow with SMS verification codes, signed PDF generation, and Stage 5 proof script against deployed AWS resources
- Stage 6 complete in this branch: gallery schema/services, direct-to-S3 multipart uploads, S3 to SQS ingest routing, ECS Fargate image processing, public gallery links, and wedding-scale proof against deployed AWS resources
- Stage 7 complete in this branch: studio spaces, equipment inventory, studio bookings with DB-level overlap exclusion, studio calendar, public booking request intake, access code verification, and Stage 7 smoke against Aurora
- Stage 8 complete in this branch: invoices, payments ledger, expenses, receipt-scan OCR intake with Textract, financial reporting endpoints, Stage 8 smoke against Aurora, and API deployment of the new `/invoices`, `/payments`, `/expenses`, and `/reports/*` routes
- Stage 9 complete in this branch: scheduled automation workers, EventBridge Scheduler orchestration, NOAA weather checks, gallery expiry/review nudges, invoice overdue nudges, access-code SMS scheduling, anniversary/dormant-client reminders, and recurring task spawning
- Stage 10 complete in this branch: root admin app converted into Kevin's installable PWA, Cognito OTP browser auth wiring, global search, time tracking, mobile shot-list/check-in screens, live Stage 10 API routes, and a real cross-region gallery-original restore drill
- Stage 11 started in this branch: provider abstraction for manual vs Stripe payments, Stripe-aware invoice checkout/refund/webhook endpoints, public Smart File payment page scaffolding with Payment Element, and admin refund wiring. Live Stripe charge testing is currently blocked by missing `studio-os/stripe/test` or `studio-os/stripe/live` secrets.

## Repo layout

- [infra](C:/Users/dramo/KevinClient/infra/package.json:1): AWS CDK stacks and deployment scripts
- [packages/database](C:/Users/dramo/KevinClient/packages/database/package.json:1): Drizzle schema, migrations, Data API client, EventBridge publisher, and shared domain services
- [docs/stage-caveats.md](C:/Users/dramo/KevinClient/docs/stage-caveats.md:1): deferred AWS and operational caveats that must be addressed later

## Stage 1 deployed resources

- `studio-os-stage-1-network`
- `studio-os-stage-1-auth`
- `studio-os-stage-1-api`
- `studio-os-stage-1-events`

Health endpoint:

- `https://2bb3ndmvqf.execute-api.us-east-1.amazonaws.com/health`

## Caveats tracked for later

See [docs/stage-caveats.md](C:/Users/dramo/KevinClient/docs/stage-caveats.md:1).

The most important ones right now:

- SNS SMS is still sandboxed in `us-east-1`
- live device-side receipt of OTP SMS has not been validated yet
- SNS spend cap is still `1 USD`, not `20 USD`
- SES sender identity and inbound recipient domain are not configured yet, so Stage 3 email delivery is code-complete but not production-cut-over
- EventBridge mutation publishing does not have an outbox/replay path yet
- Aurora resume latency is visible on the first database request after pause
- Stage 4 session task templates are code-defined, not admin-editable yet
- Stage 5 Smart File PDF generation currently runs in an SQS-triggered Lambda with `pdf-lib`, not the eventual Fargate worker required by the long-term target architecture
- Stage 5 SES delivery is still skipped until Kevin's sender identity is verified in this AWS account
- Stage 5 live proof uses a local-only helper to seed a deterministic verification code after the public verification endpoint is exercised; this avoids depending on manual SMS receipt during sandboxed setup
- Stage 6 public gallery delivery currently uses API Gateway-backed signed gallery tokens and S3 presigned asset URLs; it does not yet serve the client gallery through `/apps/gallery` or CloudFront-signed asset URLs
- Stage 6 image processing currently bootstraps dependencies inside the Fargate task from the public Node image because local Docker image builds are not available in this environment
- Stage 7 public studio browsing currently uses a Lambda-rendered HTML page at `/studio/page`; the `/apps/studio` frontend is still deferred
- Stage 7 studio booking confirmation does not yet auto-instantiate the combined Smart File package for waiver/invoice/access instructions; the booking and inquiry primitives are in place first
- Stage 8 expense receipt OCR is wired to Textract through an S3 upload bucket and object-created notifications, but live end-to-end browser proof of the admin upload flow is still gated on the Cognito SMS sandbox caveat
- Stage 8 Aurora verification required retry-aware scripts because `0 ACU` pause/resume can interrupt the first Data API call with `DatabaseResumingException`
- Stage 9 recurring automations run from EventBridge Scheduler-triggered Lambdas, but there is not yet a generalized sequence-definition engine or admin-editable automation catalog
- Stage 9 monthly reports currently send Kevin a P&L snapshot email, but retainer invoice generation remains manual because recurring billing primitives do not exist yet
- Stage 9 weather checks only alert when a session has `locationCoords`; sessions without coordinates are skipped until that data is captured consistently
- Stage 10 reuses the existing repo root Next.js app as the admin PWA instead of moving immediately to `/apps/admin`; this preserved the existing repo layout and let the dashboard ship without a monorepo-wide frontend move
- Stage 10 folds the local `KevinStudio` source material into the main app at `/studio`, but the original folder still exists on disk as reference material and is excluded from the root TypeScript build
- Stage 10 had to remove API-stack Lambda log-retention resources to stay below CloudFormation's 500-resource limit; API Lambda logs therefore fall back to default retention until the API stack is split
- Stage 10 leaves the API stack at `448` resources, which is safely deployable now but still close enough to the CloudFormation ceiling that further API growth should be accompanied by an infra split
- Stage 10 browser login UX is implemented, but real Kevin device validation is still constrained by the Stage 1 SNS sandbox and spend-cap caveats
- Stage 10 acceptance covers every current "stop switching platforms" item except Stage 11's live Stripe card/ACH payment path
- Stage 11 code is deployed, but the expected Stripe Secrets Manager entries are not present yet, so provider status currently resolves to unavailable and checkout initialization intentionally returns a configuration error instead of failing silently

## Stage 3 routes

- `POST /inquiries`: public inquiry intake, idempotent via `Idempotency-Key`
- `GET /inquiries`: Kevin-only, protected by Cognito JWT authorizer
- `GET /inbox`: Kevin-only, protected by Cognito JWT authorizer
- `GET /clients/{id}/timeline`: Kevin-only, protected by Cognito JWT authorizer

## Stage 4 routes

- `POST /sessions`: Kevin-only, idempotent via `Idempotency-Key`
- `GET /sessions`: Kevin-only, session list
- `GET /sessions/{id}/shot-list`: Kevin-only, mobile-friendly shot list fetch
- `PUT /sessions/{id}/shot-list`: Kevin-only, shot list upsert
- `GET /calendar`: Kevin-only, unified calendar JSON
- `GET /dashboard`: Kevin-only, dashboard summary counts and upcoming sessions
- `POST /calendar/feed-token`: Kevin-only, mint long-lived signed iCal token
- `POST /calendar/feed-token/revoke`: Kevin-only, revoke existing iCal tokens by version bump
- `GET /calendar.ics?token=`: public read-only iCal feed via signed JWT

## Stage 5 routes

- `POST /smart-file-templates`: Kevin-only, create a Smart File template
- `GET /smart-file-templates`: Kevin-only, list Smart File templates
- `POST /smart-files`: Kevin-only, instantiate a Smart File from a template
- `GET /smart-files`: Kevin-only, list Smart Files
- `GET /smart-files/{id}`: Kevin-only, fetch one Smart File
- `POST /smart-files/{id}/send`: Kevin-only, mint the public signing link and attempt SES delivery
- `GET /sign/{token}`: public Smart File viewer via signed token
- `POST /sign/{token}/request-verification`: public SMS verification-code request
- `POST /sign/{token}/submit`: public Smart File submission and signature capture

## Stage 6 routes

- `POST /galleries`: Kevin-only, create a gallery record
- `GET /galleries`: Kevin-only, list galleries
- `GET /galleries/{id}`: Kevin-only, fetch one gallery and its photos
- `POST /galleries/{id}/share`: Kevin-only, mint a signed public gallery link
- `POST /galleries/{id}/uploads`: Kevin-only, initiate direct S3 multipart upload for one photo
- `POST /galleries/{id}/uploads/{photoId}/part-url`: Kevin-only, mint a presigned upload-part URL
- `POST /galleries/{id}/uploads/{photoId}/complete`: Kevin-only, complete multipart upload
- `GET /gallery/{token}`: public gallery JSON via signed token
- `GET /gallery/{token}/page`: public gallery HTML page via signed token

## Stage 7 routes

- `POST /studio/spaces`: Kevin-only, create a studio space
- `GET /studio/spaces`: Kevin-only, list studio spaces
- `POST /studio/equipment`: Kevin-only, create a studio equipment item
- `GET /studio/equipment`: Kevin-only, list studio equipment
- `POST /studio/bookings`: Kevin-only, create a studio booking
- `GET /studio/bookings`: Kevin-only, list studio bookings
- `GET /studio/bookings/{id}`: Kevin-only, fetch one studio booking with equipment items
- `PATCH /studio/bookings/{id}`: Kevin-only, update booking status/details; completion creates the turnover task
- `GET /studio/calendar?from&to&space_id=`: Kevin-only, studio booking calendar plus turnover buffers and Kevin own-studio session blocks
- `GET /studio/page`: public studio landing page
- `POST /studio/booking-request`: public booking inquiry intake; creates an inquiry with `event_type='studio_rental'`
- `POST /studio/access/verify`: public access-code verification webhook shape; logs every attempt

## Stage 8 routes

- `POST /invoices`: Kevin-only, idempotent invoice creation
- `GET /invoices`: Kevin-only, invoice list filtered by `clientId` and `status`
- `GET /invoices/{id}`: Kevin-only, fetch one invoice and its payments
- `POST /payments`: Kevin-only, idempotent manual payment recording
- `GET /payments`: Kevin-only, list payments, optionally by `invoiceId`
- `POST /expenses`: Kevin-only, idempotent expense creation with optional OCR-backed defaults from a receipt scan
- `GET /expenses`: Kevin-only, expense list filtered by category/date range
- `POST /expenses/receipt-scans`: Kevin-only, create a pending receipt scan and mint a presigned upload URL into the receipt bucket
- `GET /expenses/receipt-scans/{id}`: Kevin-only, fetch one receipt scan and OCR status/result fields
- `GET /reports/revenue?year=`: Kevin-only, monthly paid and outstanding revenue split
- `GET /reports/profit?year=`: Kevin-only, monthly revenue/expense/profit summary
- `GET /reports/tax-year?year=`: Kevin-only, Schedule C-oriented income and expense-category summary
- `GET /reports/studio-utilization?year=`: Kevin-only, booked hours, estimated available hours, utilization, and busiest studio periods
- `GET /reports/conversion`: Kevin-only, inquiry conversion by event type and referral source
- `GET /reports/turnaround`: Kevin-only, average shoot-to-delivery timing
- `GET /reports/referrals`: Kevin-only, referral sources ranked by client count and lifetime value
- `GET /reports/ltv`: Kevin-only, clients ranked by lifetime value with repeat-booking likelihood

## Stage 9 automations

- Sequence runner: scheduled Smart File sends, T-7 session reminders, post-session thank-yous, T-24h studio reminders, post-booking review requests, and expired-hold cancellation
- Weather fetcher: NOAA severe-weather check for sessions with coordinates roughly 36-60 hours out
- Gallery expiry worker: 7-day expiry warnings and 14-day review nudges after gallery delivery
- Invoice overdue worker: overdue status updates, 3-day client email nudges, and 14-day Kevin SMS alerts
- Access code SMS worker: sends renter access codes inside the T-2h booking window
- Anniversary reminders: Kevin SMS on wedding anniversaries and dormant repeat-client follow-up task creation
- Monthly reports: email Kevin a monthly P&L summary on the first of each month
- Recurring task spawner: expands RRULE-based admin/session/studio tasks into dated task instances

## Stage 10 routes

- `GET /clients`: Kevin-only, unified client list with name/contact search
- `GET /tasks`: Kevin-only, task list with limit and status filtering
- `GET /search?q=`: Kevin-only, cross-entity search across clients, inquiries, sessions, Smart Files, galleries, studio bookings, invoices, tasks, and inbox activity
- `GET /time-entries`: Kevin-only, recent time entries plus active/today/week summary
- `POST /time-entries`: Kevin-only, idempotent timer start / manual time entry creation
- `POST /time-entries/{id}/stop`: Kevin-only, idempotent timer stop

## Stage 11 routes

- `GET /payments/provider`: Kevin-only, returns the active payment-provider configuration and whether Stripe is currently available
- `POST /invoices/{id}/checkout`: Kevin-only, idempotently creates a Stripe PaymentIntent client secret for the selected invoice amount
- `POST /payments/{id}/refund`: Kevin-only, idempotently creates a Stripe refund, records the negative ledger row, updates the invoice, and emails the client when sender email is configured
- `GET /sign/{token}/page`: public Smart File payment page with embedded Stripe Payment Element bootstrap
- `POST /sign/{token}/payment-intent`: public Smart File checkout initializer for payable invoices attached to the Smart File/session/client context
- `POST /webhooks/stripe`: public Stripe webhook endpoint for payment success and refund reconciliation

## Stage 10 app surfaces

- `/`: Kevin's admin dashboard PWA with OTP login, overview KPIs, search, timer, pipeline, sessions, studio, finance, operations, and inbox context
- `/studio`: folded studio reference page built from the local `KevinStudio` source material
- `/session/{id}/shot-list`: mobile-friendly shot-list checkoff surface
- `/studio-booking/{id}/check-in`: mobile-friendly studio booking check-in / checkout surface
- `/manifest.webmanifest` + `public/sw.js`: installable PWA shell and offline asset caching scaffold

## Stage 3 commands

Infra:

```bash
cd infra
pnpm run build
pnpm run synth
pnpm exec cdk -a "tsx bin/studio-os.ts" deploy studio-os-stage-1-data --require-approval never
```

Database:

```bash
pnpm --filter @studio-os/database build
pnpm --filter @studio-os/database migrate
pnpm --filter @studio-os/database smoke
pnpm --filter @studio-os/database smoke:stage3
pnpm --filter @studio-os/database smoke:stage4
```

Stage 5 proof:

```bash
cd infra
pnpm run prove:stage5
```

Stage 6 proof:

```bash
cd infra
pnpm run prove:stage6
```

Latest Stage 6 live proof on `2026-04-18`:

- 5-photo smoke passed with gallery `ready`, `5/5` photos processed, and DLQ `0`
- 500-photo kill-criterion passed with gallery `ready`, `500/500` photos processed, queue `0`, DLQ `0`
- 500-photo timings: upload `10477 ms`, processing `92298 ms`, total `103976 ms`

Stage 7 smoke:

```bash
pnpm --filter @studio-os/database smoke:stage7
```

Latest Stage 7 smoke on `2026-04-19`:

- access code issued for a confirmed, deposit-paid booking
- access verification returned `valid: true`
- overlapping same-space booking was rejected
- Kevin own-studio session conflict was rejected
- booking update to `completed` succeeded

Stage 8 smoke:

```bash
pnpm --filter @studio-os/database smoke:stage8
```

Latest Stage 8 smoke on `2026-04-19`:

- created a shared client, wedding session, studio booking, two invoices, one manual payment, one OCR-completed receipt scan, and one expense
- revenue report returned `175000` cents paid in March 2026 with `202000` cents still outstanding
- profit report returned `126500` cents for March 2026 after a `48500` cent gear expense
- studio utilization report returned booked hours and revenue for the seeded Stage 8 studio booking
- LTV report flagged the seeded client as a likely repeat booker with `2` recent bookings

Stage 9 deploy and verification:

```bash
cd infra
pnpm run build
pnpm exec cdk -a "tsx bin/studio-os.ts" deploy studio-os-stage-1-events --require-approval never
```

Latest Stage 9 live proof on `2026-04-19`:

- `SequenceRunnerFunction` succeeded after the studio-booking date-window Data API fix and returned automation counters without function errors
- `InvoiceOverdueFunction` succeeded and updated overdue invoice statuses on seeded Stage 8 data
- `AccessCodeSmsFunction` succeeded after the same date-window fix and returned an access-code send count without function errors
- `RecurringTaskSpawnerFunction` succeeded and safely no-op'd when no RRULE task instance was due
- `WeatherFetcherFunction` succeeded and safely no-op'd when no eligible coordinate-bearing session fell in the weather check window

Latest Stage 10 live proof on `2026-04-19`:

- Protected Stage 10 HTTP routes responded with `401` without a Cognito bearer token, confirming they are live behind the JWT authorizer
- `ListClientsFunction` direct invoke returned `200` with `3` seeded clients, led by `Stage 8 Financial Client`
- `SearchFunction` direct invoke returned `200` with `5` cross-entity matches for `stage`
- `CreateTimeEntryFunction` returned `201`, `ListTimeEntriesFunction` returned `200` with the new timer as the active entry, and `StopTimeEntryFunction` returned `200` with a persisted `endedAt`
- Cross-region restore drill copied `galleries/019da26a-84bf-700b-a925-f8140c89863a/incoming/019da26a-8ace-731d-a701-1825643d454a/stage-6-proof-0000.png` from `studio-os-stage-1-gallery-originals-west-2-279630655712` back into `studio-os-stage-1-gallery-originals-279630655712/restore-drill/2026-04-19/stage-6-proof-0000.png`
- Restore verification passed with identical SHA-256 on source replica and restored copy: `B43253E9B9235BACE5AB1315586C7BAF46996435DDA42D62E445F1AB1CB8AEB1`

Latest Stage 11 live proof on `2026-04-19`:

- `GET /payments/provider` returned `401` over HTTP without a Cognito token, confirming the protected Stage 11 admin route is live
- `GetPaymentProviderFunction` direct invoke returned `200` with `provider="manual"` and `available=false`, proving the missing-secret condition is surfaced explicitly rather than as a Lambda failure
- `GET /sign/stage11-smoke/page` returned `200` and served the public Stripe Payment Element page scaffold
- `PublicSmartFilePaymentIntentFunction` direct invoke returned `401` for an invalid Smart File token instead of a generic `500`
- `StripeWebhookFunction` direct invoke returned `503` with `eventType="configuration.missing"` when `studio-os/stripe/test` was absent, proving the webhook now fails explicitly instead of silently succeeding on manual fallback
