<!-- Stage 11.5 Documentation Purpose -->
# Restart Handoff

This file is the single restart point for the next session.

## Current baseline

- Repo: `KevinClient`
- Branch state pushed to `main`
- Latest pushed commit: `ff227f6` `refactor(ui): strip AI-tell visual patterns from admin shell`
- Previous commit on main: `7d8ef34` `feat(ui): redesign admin PWA as monday.com-style operator dashboard`
- Date of last verified work: `2026-04-20`

## What shipped this session (UI redesign)

The Stage 10 admin PWA was rebuilt into a production-looking operator
dashboard. Backend contracts and routes are unchanged. The work is purely on
the Next.js app in `src/`.

### New surfaces and shells

- Full app shell with fixed left sidebar (Workspace / Links groups) and
  sticky top bar (search, running-timer pill, notifications, demo badge,
  avatar menu).
- Overview page: date strip + `Overview` heading, four KPI cards, `Coming
  up` session list, live timer panel.
- Pipeline kanban across `New` / `Qualifying` / `Proposal sent` / `Booked`.
- Sessions table with per-row `Shot list` and `Timer` actions plus a
  conversion-by-type strip.
- Studio section: bookings list, `Spaces`, `Equipment`, public-listing
  card that links to `/studio`.
- Finance: four stat cards, invoices table, provider/payments panel with
  Stripe refund action, recent expenses two-column list.
- Tasks kanban (`open` / `in_progress` / `completed`) driven by priority.
- Activity inbox list.
- Mobile shot list and studio check-in pages were fully reskinned.
- `/studio` reference page reskinned to match.

Relevant files:

- [src/components/studio-os-app.tsx](C:/Users/dramo/KevinClient/src/components/studio-os-app.tsx:1)
- [src/components/studio-os-auth-provider.tsx](C:/Users/dramo/KevinClient/src/components/studio-os-auth-provider.tsx:1)
- [src/lib/studio-os-demo-data.ts](C:/Users/dramo/KevinClient/src/lib/studio-os-demo-data.ts:1)
- [src/app/session/[id]/shot-list/page.tsx](C:/Users/dramo/KevinClient/src/app/session/[id]/shot-list/page.tsx:1)
- [src/app/studio-booking/[id]/check-in/page.tsx](C:/Users/dramo/KevinClient/src/app/studio-booking/[id]/check-in/page.tsx:1)
- [src/app/studio/page.tsx](C:/Users/dramo/KevinClient/src/app/studio/page.tsx:1)
- [src/app/globals.css](C:/Users/dramo/KevinClient/src/app/globals.css:1)

### Demo mode

`http://localhost:3001/?demo=1` sets `studio-os-admin-demo-mode-v1=1` in
localStorage, synthesizes a local session, and short-circuits
`authorizedFetch` inside the auth provider to return seeded payloads from
`src/lib/studio-os-demo-data.ts`. No AWS calls are made in demo mode. Use
`?demo=0` to clear the flag.

Single-record routes that are seeded:

- `GET /studio/bookings/:id` returns a specific booking from the seed map
- `GET /sessions/:id/shot-list` returns a seeded session + shot-list payload

All list endpoints the dashboard reads (`/dashboard`, `/inquiries`,
`/sessions`, `/calendar`, `/smart-files`, `/galleries`, `/studio/...`,
`/invoices`, `/payments`, `/payments/provider`, `/expenses`, `/tasks`,
`/inbox`, `/reports/*`, `/time-entries`, `/search`) return demo JSON with
realistic shape.

### AI-tell removal pass

After the initial redesign, a second pass stripped dashboard-template
giveaways. Summary of changes so the next session understands why the UI
looks the way it does:

- Removed gradient top-bars on stat cards.
- Flat chip system, no `ring-inset`, no uppercase chrome.
- Removed eyebrow-then-serif-headline pattern on every section; there is a
  single sans-serif `h2` per section.
- Pipeline and Tasks columns use a 6px status dot instead of full pills.
- Login simplified to a single column, no dark marketing panel,
  no AWS-service name-drops.
- `Field-ready PWA` sidebar callout removed.
- Copy pass deleted scripted aspirational lines
  (`Stop switching platforms.`, `Kanban view of every inquiry, from new →
  booked. Drag-and-drop coming in the alpha.`, etc.).
- `globals.css` no longer forces `h1-h4` to Bodoni serif; serif is opt-in
  via `font-serif` on the login logo and the `K` avatar only.

## Important one-time env side effect

`~/tailwind.config.ts` was moved to `~/tailwind.config.ts.bak-studio-os`
because Next.js Turbopack was traversing out of the KevinClient directory
and failing to resolve `tailwindcss` from that stray config file (it was
left over from an unrelated project in `C:\Users\dramo`).

Action for the next session:

- If nothing else in `C:\Users\dramo` needs that file, leave it as `.bak`.
- If another project needed it, move it into that project's own subdir so
  it no longer sits in the user home and bleeds into other workspaces.

## What is live backend-side (unchanged from previous handoff)

- Temporary Kevin-only OTP override is deployed in Cognito auth Lambdas.
- For the allowlisted phone `+19548541484`, OTP `999999` currently works.
- The override was verified live with `AdminInitiateAuth` and
  `AdminRespondToAuthChallenge`, returning access and refresh tokens.
- `event_outbox` migration `0010_stage_11_5_event_outbox.sql` is applied.
- Shared database write paths enqueue outbox events transactionally for
  most services.
- Scheduled outbox publisher Lambda is deployed in
  `studio-os-stage-1-events`.
- Outbox CloudWatch alarms are deployed (stale unpublished rows, retry
  threshold exceeded).
- Audit partition precreate scheduler is deployed.
- A live outbox smoke passed (created inquiry → outbox row inserted →
  publisher marked `published_at`, `attempt_count` stayed `0`).

## Important temporary backend behavior

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
- There is no usable U.S. origination identity yet, which blocks real SMS
  sends.

Reference: [docs/aws-account-state.md](C:/Users/dramo/KevinClient/docs/aws-account-state.md:1)

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

Reference: [docs/stripe-runbook.md](C:/Users/dramo/KevinClient/docs/stripe-runbook.md:1)

## Best next tasks when work resumes

The frontend is now in good enough shape to demo and to hand to early-beta
testers. The highest-leverage next tasks fall into two buckets.

### Frontend follow-ups (optional polish)

These are nice-to-haves that surfaced during the redesign but weren't
required for a demoable beta:

1. Drag-and-drop between pipeline columns (currently inquiries are bucketed
   by `status` but can't be moved from the UI).
2. `New inquiry` / `New session` / `New invoice` buttons are non-functional
   placeholders. Wire each to the existing idempotent `POST` endpoints.
3. Inline create for Tasks in each kanban column.
4. Refund confirmation modal before hitting `/payments/:id/refund` in Stripe
   mode; current flow fires immediately.
5. Real-time refresh: SWR-style revalidation on window focus rather than a
   manual reload after mutations.
6. Replace the `Add` icons in kanban column headers with keyboard shortcuts
   and a toast system for mutation feedback.
7. Remove the temporary `Demo data` badge styling and allow a "deep-linked"
   demo session URL for sharing the demo without stickying localStorage.

### Backend work (from previous handoff, still valid)

Work from this list in order unless an external blocker gets cleared first.

1. **Finish Ticket 1.1 completely.** Shared service-layer writes mostly use
   the outbox; `packages/database/src/services/studio-bookings-service.ts`
   still has a raw SQL path outside the same transaction pattern. Move it
   onto the outbox pattern as far as safely possible, then add a proof
   script for burst writes + interrupted publisher + replay after restart,
   and validate no duplicate downstream effects.

   Files:
   - [packages/database/src/services/studio-bookings-service.ts](C:/Users/dramo/KevinClient/packages/database/src/services/studio-bookings-service.ts:1)
   - [packages/database/src/services/event-outbox-service.ts](C:/Users/dramo/KevinClient/packages/database/src/services/event-outbox-service.ts:1)
   - [infra/lambda/events-outbox-publisher/index.ts](C:/Users/dramo/KevinClient/infra/lambda/events-outbox-publisher/index.ts:1)

2. **Keep Ticket 1.2 in monitoring state.** Scheduler and fallback metric
   are live. Acceptance is 30 days with zero fallback warnings. Do not
   rewrite it; just check logs/metrics for unexpected
   `audit.partition.fallback_created`.

3. **Ticket 1.3 PDF generation to Fargate.** PDF worker is still Lambda +
   `pdf-lib`. Add a `pdf-generator` worker path using the Stage 6 media
   pattern. Add queue + task definition + image build. Move signed-PDF
   generation off the Lambda path behind a flag.

4. **Ticket 1.4 Worker images to ECR.** Pairs with 1.3. Build Dockerfiles
   for the image processor and PDF generator. Wire GitHub Actions OIDC →
   ECR publish.

5. **Ticket 1.5 API stack split.** `studio-os-stage-1-api` sits at 448 of
   500 CloudFormation resources. Split into domain stacks and reintroduce
   log retention consistently after the split.

## Best non-coding tasks for Kevin before the next session

If Kevin wants the next session to move faster, these unblock the most:

1. File the SNS production-access request and try sandbox verification for
   `+19548541484`.
2. Decide and provide the SES sending domain.
3. Create the Stripe test secret and webhook in AWS + Stripe dashboard.

Without those three, major portions of Stage 11.5 remain only partially
verifiable.

## Fast resume checklist for next session

Start with these in order:

1. Open [docs/restart-handoff.md](C:/Users/dramo/KevinClient/docs/restart-handoff.md:1)
2. Open [docs/stage-caveats.md](C:/Users/dramo/KevinClient/docs/stage-caveats.md:1)
3. Run `git status --short`
4. Confirm `main` includes commit `ff227f6`
5. From the `KevinClient` directory run `pnpm.cmd dev` and open
   `http://localhost:3001/?demo=1` to confirm the demo dashboard renders
   without auth.
6. Decide whether the session is:
   - external-account setup follow-up (SNS / SES / Stripe)
   - frontend follow-up polish from the list above
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

### Run the frontend in demo mode

```powershell
pnpm.cmd dev
# then open http://localhost:3001/?demo=1
```

## Documents to keep in sync

- [docs/restart-handoff.md](C:/Users/dramo/KevinClient/docs/restart-handoff.md:1)
- [docs/stage-caveats.md](C:/Users/dramo/KevinClient/docs/stage-caveats.md:1)
- [docs/aws-account-state.md](C:/Users/dramo/KevinClient/docs/aws-account-state.md:1)
- [docs/stripe-runbook.md](C:/Users/dramo/KevinClient/docs/stripe-runbook.md:1)

## Short version

If the next session needs the one-paragraph summary:

`main` is at `ff227f6`. The admin PWA has been fully rebuilt into an
app-shell dashboard (sidebar + top bar + overview / pipeline / sessions /
studio / finance / tasks / inbox) and then polished to remove AI-template
giveaways. A `?demo=1` query flag swaps `authorizedFetch` to seeded data so
the frontend can be demoed without AWS. Backend is unchanged: temporary
OTP `999999` is still deployed for Kevin's phone, outbox and audit-partition
hardening are live, and the biggest unresolved items remain external
account setup for SNS, SES, and Stripe, plus the buildable hardening work
led by finishing Ticket `1.1`, then moving PDF generation to Fargate in
Ticket `1.3`.
