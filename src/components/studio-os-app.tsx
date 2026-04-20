// Stage 10 Admin App Purpose
"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from "react";
import { foldedStudioSource } from "@/lib/studio-source";
import { studioOsRuntimeConfig } from "@/lib/studio-os-config";
import { useStudioOsAuth } from "./studio-os-auth-provider";

type LooseRecord = Record<string, any>;

const sectionLinks = [
  ["overview", "Overview"],
  ["pipeline", "Pipeline"],
  ["sessions", "Sessions"],
  ["studio", "Studio"],
  ["finance", "Finance"],
  ["operations", "Operations"],
] as const;

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const money = (cents?: number) => currencyFormatter.format((cents ?? 0) / 100);
const shortDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(new Date(value))
    : "Not scheduled";
const duration = (minutes?: number) => {
  const safeMinutes = minutes ?? 0;
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
};
const requestKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);
const asArray = (value: unknown) => (Array.isArray(value) ? value : []);
const asRecord = (value: unknown) => ((value && typeof value === "object" ? value : {}) as LooseRecord);

function LoginPanel() {
  const { status, challengePhoneNumber, requestCode, verifyCode, isWorking, errorMessage } = useStudioOsAuth();
  const [phoneNumber, setPhoneNumber] = useState(studioOsRuntimeConfig.allowedPhoneNumber);
  const [otpCode, setOtpCode] = useState("");

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f4efe5_0%,_#ece2d1_100%)] px-5 py-8 text-stone-950">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-[2rem] border border-stone-800 bg-stone-950 p-8 text-stone-100 shadow-[0_28px_120px_rgba(0,0,0,0.28)]">
          <div className="inline-flex rounded-full border border-white/12 px-3 py-1 text-[0.64rem] uppercase tracking-[0.28em] text-stone-300">
            Kevin&apos;s Studio OS
          </div>
          <h1 className="mt-6 max-w-2xl font-serif text-5xl leading-[0.94] lg:text-7xl">
            One backend. One operator. No platform juggling.
          </h1>
          <p className="mt-5 max-w-xl text-sm leading-7 text-stone-300 lg:text-base">
            The admin PWA sits on top of the existing AWS stack: Cognito phone OTP, Aurora Serverless v2, API Gateway,
            EventBridge automation, gallery processing, studio bookings, Smart Files, reporting, search, and time tracking.
          </p>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white/90 p-7 shadow-[0_24px_90px_rgba(89,66,33,0.14)]">
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-500">Kevin-only sign in</p>
          <h2 className="mt-3 font-serif text-3xl text-stone-950">Phone OTP login</h2>
          <p className="mt-3 text-sm leading-7 text-stone-600">
            Beta runtime points at <span className="font-semibold">{studioOsRuntimeConfig.apiUrl}</span>.
          </p>

          {status !== "challenge" ? (
            <form className="mt-7 space-y-4" onSubmit={(event) => void (event.preventDefault(), requestCode(phoneNumber))}>
              <input
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 outline-none transition focus:border-stone-950"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                inputMode="tel"
              />
              <button className="w-full rounded-2xl bg-stone-950 px-4 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-stone-50" disabled={isWorking}>
                {isWorking ? "Sending code" : "Send OTP"}
              </button>
            </form>
          ) : (
            <form className="mt-7 space-y-4" onSubmit={(event) => void (event.preventDefault(), verifyCode(otpCode))}>
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                Code sent to {challengePhoneNumber}. Sandbox caveats still apply until SNS production access is lifted.
              </div>
              <input
                className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-center tracking-[0.35em] outline-none transition focus:border-stone-950"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                inputMode="numeric"
                maxLength={6}
              />
              <button className="w-full rounded-2xl bg-stone-950 px-4 py-4 text-sm font-semibold uppercase tracking-[0.22em] text-stone-50" disabled={isWorking}>
                {isWorking ? "Verifying" : "Enter dashboard"}
              </button>
            </form>
          )}

          {errorMessage ? <p className="mt-4 text-sm text-rose-600">{errorMessage}</p> : null}
        </section>
      </div>
    </main>
  );
}

function Panel({
  id,
  title,
  eyebrow,
  children,
}: {
  readonly id: string;
  readonly title: string;
  readonly eyebrow: string;
  readonly children: React.ReactNode;
}) {
  return (
    <section id={id} className="rounded-[1.7rem] border border-stone-200 bg-white/88 p-5 shadow-[0_20px_60px_rgba(84,65,38,0.08)]">
      <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-500">{eyebrow}</p>
      <h2 className="mt-2 font-serif text-3xl text-stone-950">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function StudioOsApp() {
  const { status, session, authorizedFetch, logout } = useStudioOsAuth();
  const [dashboard, setDashboard] = useState<LooseRecord | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<LooseRecord[]>([]);
  const [timeTitle, setTimeTitle] = useState("");
  const [timeNotes, setTimeNotes] = useState("");
  const [timeScope, setTimeScope] = useState("admin");
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const deferredSearch = useDeferredValue(searchInput);

  const loadDashboard = useEffectEvent(async () => {
    if (status !== "authenticated") {
      return;
    }

    setLoading(true);
    setErrorMessage(null);

    try {
      const year = new Date().getUTCFullYear();
      const range = `from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(
        new Date(Date.now() + 14 * 86400000).toISOString(),
      )}`;
      const requests = await Promise.all([
        authorizedFetch("/dashboard").then((response) => response.json()),
        authorizedFetch("/inquiries?limit=8").then((response) => response.json()),
        authorizedFetch("/sessions?limit=8").then((response) => response.json()),
        authorizedFetch(`/calendar?${range}`).then((response) => response.json()),
        authorizedFetch("/smart-files").then((response) => response.json()),
        authorizedFetch("/galleries").then((response) => response.json()),
        authorizedFetch("/studio/bookings").then((response) => response.json()),
        authorizedFetch("/studio/spaces").then((response) => response.json()),
        authorizedFetch("/studio/equipment").then((response) => response.json()),
        authorizedFetch("/invoices").then((response) => response.json()),
        authorizedFetch("/payments?limit=10").then((response) => response.json()),
        authorizedFetch("/payments/provider").then((response) => response.json()),
        authorizedFetch("/expenses").then((response) => response.json()),
        authorizedFetch("/tasks?limit=10").then((response) => response.json()),
        authorizedFetch("/inbox").then((response) => response.json()),
        authorizedFetch(`/reports/revenue?year=${year}`).then((response) => response.json()),
        authorizedFetch(`/reports/profit?year=${year}`).then((response) => response.json()),
        authorizedFetch(`/reports/conversion`).then((response) => response.json()),
        authorizedFetch(`/reports/ltv`).then((response) => response.json()),
        authorizedFetch("/time-entries?limit=12").then((response) => response.json()),
      ]);

      setDashboard({
        summary: requests[0],
        inquiries: asArray(asRecord(requests[1]).inquiries),
        sessions: asArray(asRecord(requests[2]).sessions),
        calendar: asArray(asRecord(requests[3]).entries),
        smartFiles: asArray(asRecord(requests[4]).smartFiles),
        galleries: asArray(asRecord(requests[5]).galleries),
        bookings: asArray(asRecord(requests[6]).bookings),
        spaces: asArray(asRecord(requests[7]).spaces),
        equipment: asArray(asRecord(requests[8]).equipment),
        invoices: asArray(asRecord(requests[9]).invoices),
        payments: asArray(asRecord(requests[10]).payments),
        paymentProvider: asRecord(requests[11]).configuration,
        expenses: asArray(asRecord(requests[12]).expenses),
        tasks: asArray(asRecord(requests[13]).tasks),
        inbox: asArray(asRecord(requests[14]).activities),
        revenue: asRecord(requests[15]),
        profit: asRecord(requests[16]),
        conversion: asRecord(requests[17]),
        ltv: asRecord(requests[18]),
        time: asRecord(requests[19]),
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to load dashboard.");
    } finally {
      setLoading(false);
    }
  });

  useEffect(() => {
    if (status === "authenticated") {
      void loadDashboard();
    }
  }, [loadDashboard, status]);

  useEffect(() => {
    if (status !== "authenticated" || deferredSearch.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    authorizedFetch(`/search?q=${encodeURIComponent(deferredSearch)}&limit=8`)
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled) {
          setSearchResults(asArray(asRecord(payload).results) as LooseRecord[]);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchResults([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authorizedFetch, deferredSearch, status]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const activeEntry = asRecord(asRecord(asRecord(dashboard?.time).summary).activeEntry);
  const activeMinutes = activeEntry.startedAt
    ? Math.max(0, Math.round((nowTick - new Date(activeEntry.startedAt).getTime()) / 60000))
    : 0;
  const upcomingSessions = asArray(asRecord(dashboard?.summary).upcomingSessions);

  const quickStartTimer = async (scope = timeScope, scopeId?: string, title = timeTitle) => {
    if (!title.trim()) {
      setErrorMessage("A timer title is required.");
      return;
    }

    await authorizedFetch("/time-entries", {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": requestKey() },
      body: JSON.stringify({ scope, scopeId: scopeId ?? null, title: title.trim(), notes: timeNotes.trim() || null }),
    });

    setTimeTitle("");
    setTimeNotes("");
    setTimeScope("admin");
    await loadDashboard();
  };

  const stopTimer = async () => {
    if (!activeEntry.id) {
      return;
    }

    await authorizedFetch(`/time-entries/${activeEntry.id}/stop`, {
      method: "POST",
      headers: { "content-type": "application/json", "Idempotency-Key": requestKey() },
      body: JSON.stringify({ notes: timeNotes.trim() || activeEntry.notes || null }),
    });

    setTimeNotes("");
    await loadDashboard();
  };

  const refundStripePayment = async (paymentId: string) => {
    setRefundingPaymentId(paymentId);
    setErrorMessage(null);

    try {
      await authorizedFetch(`/payments/${paymentId}/refund`, {
        method: "POST",
        headers: { "content-type": "application/json", "Idempotency-Key": requestKey() },
        body: JSON.stringify({}),
      });
      await loadDashboard();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to refund payment.");
    } finally {
      setRefundingPaymentId(null);
    }
  };

  const kpis = useMemo(
    () => [
      ["New inquiries", asRecord(dashboard?.summary).new_inquiry_count ?? 0],
      ["Active sessions", asRecord(dashboard?.summary).active_session_count ?? 0],
      ["Open tasks", asRecord(dashboard?.summary).open_task_count ?? 0],
      ["Outstanding", money(asRecord(asRecord(dashboard?.revenue).totals).outstandingCents)],
    ],
    [dashboard],
  );

  if (status !== "authenticated" || !session) {
    return <LoginPanel />;
  }

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f4efe5_0%,_#efe7d9_50%,_#f8f4ed_100%)] px-4 py-4 text-stone-950 lg:px-6 lg:py-6">
      <div className="mx-auto grid max-w-[1480px] gap-4 xl:grid-cols-[250px,minmax(0,1fr)]">
        <aside className="rounded-[1.8rem] border border-stone-800 bg-stone-950 px-5 py-6 text-stone-100 shadow-[0_24px_90px_rgba(0,0,0,0.28)]">
          <div className="rounded-full border border-white/12 px-3 py-1 text-[0.64rem] uppercase tracking-[0.28em] text-stone-300">
            Studio OS PWA
          </div>
          <h1 className="mt-5 font-serif text-4xl leading-[0.94]">Kevin dashboard</h1>
          <p className="mt-3 text-sm leading-7 text-stone-300">
            Signed in as {session.phoneNumber}. Install this view on mobile for shot lists and check-in.
          </p>
          <nav className="mt-8 space-y-2">
            {sectionLinks.map(([id, label]) => (
              <a key={id} href={`#${id}`} className="block rounded-2xl bg-white/6 px-4 py-3 text-sm transition hover:bg-white/10">
                {label}
              </a>
            ))}
          </nav>
          <div className="mt-8 space-y-2 rounded-3xl bg-white/6 p-4">
            <Link href="/studio" className="block rounded-2xl bg-white/8 px-3 py-3 text-sm transition hover:bg-white/12">
              Folded studio preview
            </Link>
            <a
              href={`${studioOsRuntimeConfig.apiUrl}/studio/page`}
              target="_blank"
              rel="noreferrer"
              className="block rounded-2xl bg-white/8 px-3 py-3 text-sm transition hover:bg-white/12"
            >
              Live public studio endpoint
            </a>
          </div>
          <button
            type="button"
            onClick={logout}
            className="mt-8 w-full rounded-2xl border border-white/15 px-4 py-3 text-sm font-semibold uppercase tracking-[0.2em]"
          >
            Sign out
          </button>
        </aside>

        <div className="space-y-4">
          <section className="rounded-[1.7rem] border border-stone-200 bg-white/84 p-5 shadow-[0_20px_60px_rgba(84,65,38,0.08)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-500">North star</p>
                <h2 className="mt-2 font-serif text-4xl leading-[0.94]">Stop switching platforms.</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
                  Search, tasks, sessions, galleries, studio bookings, contracts, invoices, expenses, inbox, and timer all
                  run on the same backend.
                </p>
              </div>
              <div className="relative w-full max-w-xl">
                <input
                  className="w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm outline-none transition focus:border-stone-950"
                  placeholder="Search clients, sessions, galleries, invoices, tasks..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
                {searchResults.length > 0 ? (
                  <div className="absolute right-0 z-20 mt-2 w-full rounded-3xl border border-stone-200 bg-white p-2 shadow-[0_20px_60px_rgba(84,65,38,0.18)]">
                    {searchResults.map((result) => (
                      <a
                        key={`${result.entityType}:${result.entityId}`}
                        href={
                          result.entityType === "session"
                            ? `/session/${result.entityId}/shot-list`
                            : result.entityType === "studio_booking"
                              ? `/studio-booking/${result.entityId}/check-in`
                              : "#pipeline"
                        }
                        className="block rounded-2xl px-4 py-3 transition hover:bg-stone-100"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-semibold text-stone-950">{result.title}</p>
                          <span className="text-[0.64rem] uppercase tracking-[0.18em] text-stone-500">
                            {String(result.entityType).replace("_", " ")}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-stone-500">{result.subtitle || "No preview available"}</p>
                      </a>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </section>

          {errorMessage ? (
            <section className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700">{errorMessage}</section>
          ) : null}

          <section id="overview" className="grid gap-4 xl:grid-cols-[1.3fr,0.9fr]">
            <Panel id="overview-kpis" eyebrow="Overview" title="Daily cockpit">
              <div className="grid gap-3 md:grid-cols-4">
                {kpis.map(([label, value]) => (
                  <div key={label} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-stone-500">{label}</p>
                    <p className="mt-2 font-serif text-3xl text-stone-950">{String(value)}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.24em] text-stone-500">Timer</p>
                  {activeEntry.id ? (
                    <>
                      <p className="mt-2 text-lg font-semibold text-stone-950">{activeEntry.title}</p>
                      <p className="mt-1 text-sm text-stone-500">
                        Running for {duration(activeMinutes)} since {shortDate(activeEntry.startedAt)}
                      </p>
                      <textarea
                        className="mt-3 min-h-24 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-stone-950"
                        value={timeNotes}
                        onChange={(event) => setTimeNotes(event.target.value)}
                        placeholder="Notes before stopping"
                      />
                      <button type="button" onClick={() => void stopTimer()} className="mt-3 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-50">
                        Stop timer
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        className="mt-3 w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm outline-none focus:border-stone-950"
                        value={timeTitle}
                        onChange={(event) => setTimeTitle(event.target.value)}
                        placeholder="What are you working on?"
                      />
                      <div className="mt-3 flex flex-wrap gap-2">
                        {["admin", "standalone", "session", "studio_booking"].map((scope) => (
                          <button
                            key={scope}
                            type="button"
                            onClick={() => setTimeScope(scope)}
                            className={`rounded-full px-3 py-2 text-xs uppercase tracking-[0.18em] ${timeScope === scope ? "bg-stone-950 text-stone-50" : "bg-stone-200 text-stone-700"}`}
                          >
                            {scope.replace("_", " ")}
                          </button>
                        ))}
                      </div>
                      <button type="button" onClick={() => void quickStartTimer()} className="mt-3 rounded-2xl bg-stone-950 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-50">
                        Start timer
                      </button>
                    </>
                  )}
                </div>
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-[0.68rem] uppercase tracking-[0.24em] text-stone-500">Upcoming sessions</p>
                  <div className="mt-3 space-y-2">
                    {upcomingSessions.slice(0, 5).map((item: LooseRecord) => (
                      <div key={item.id} className="rounded-2xl bg-white px-3 py-3 text-sm">
                        <p className="font-semibold text-stone-950">{item.title}</p>
                        <p className="mt-1 text-stone-500">{shortDate(item.scheduledStart)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </Panel>
            <Panel id="overview-acceptance" eyebrow="Acceptance" title="Stage 10 readiness">
              <div className="grid gap-2">
                {[
                  "Receive inquiries",
                  "Send contracts and questionnaires",
                  "Track expenses",
                  "Deliver galleries",
                  "Accept studio bookings",
                  "Email in context",
                  "Full-text search",
                  "Track time on projects",
                  "Mobile shot list and check-in",
                ].map((item) => (
                  <div key={item} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
                    <span>{item}</span>
                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-[0.64rem] uppercase tracking-[0.18em] text-emerald-800">
                      ready
                    </span>
                  </div>
                ))}
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                  Card and ACH checkout stay deferred to Stage 11 via the Stripe provider swap.
                </div>
              </div>
            </Panel>
          </section>

          <section id="pipeline" className="grid gap-4 xl:grid-cols-3">
            <Panel id="pipeline-inquiries" eyebrow="Pipeline" title="Inquiries">
              <div className="space-y-3">
                {asArray(dashboard?.inquiries).slice(0, 6).map((item: LooseRecord) => (
                  <div key={item.id} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <p className="font-semibold text-stone-950">{item.inquirerName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">
                      {item.eventType} • {item.status}
                    </p>
                    <p className="mt-2 text-sm text-stone-600">{item.message || "No message"}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel id="pipeline-smart-files" eyebrow="Smart files" title="Contracts and forms">
              <div className="space-y-3">
                {asArray(dashboard?.smartFiles).slice(0, 6).map((item: LooseRecord) => (
                  <div key={item.id} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <p className="font-semibold text-stone-950">{item.title}</p>
                    <p className="mt-2 text-sm text-stone-600">{item.recipientEmail || "No recipient email"}</p>
                    <p className="mt-2 text-xs text-stone-500">{item.status}</p>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel id="pipeline-ltv" eyebrow="Client value" title="Repeat-booking radar">
              <div className="space-y-3">
                {asArray(asRecord(dashboard?.ltv).clients).slice(0, 6).map((item: LooseRecord) => (
                  <div key={item.clientId} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-stone-950">{item.name}</p>
                      {item.repeatBookingLikely ? (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-[0.64rem] uppercase tracking-[0.18em] text-emerald-800">
                          likely repeat
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-stone-600">{money(item.lifetimeValueCents)} lifetime value</p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section id="sessions" className="grid gap-4 xl:grid-cols-[1.2fr,0.8fr]">
            <Panel id="sessions-list" eyebrow="Photography CRM" title="Sessions and mobile shot lists">
              <div className="space-y-3">
                {asArray(dashboard?.sessions).slice(0, 8).map((item: LooseRecord) => (
                  <div key={item.id} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold text-stone-950">{item.title}</p>
                        <p className="mt-1 text-sm text-stone-600">
                          {item.sessionType} • {item.locationName || "Location TBD"}
                        </p>
                        <p className="mt-1 text-xs text-stone-500">{shortDate(item.scheduledStart)}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/session/${item.id}/shot-list`} className="rounded-full bg-stone-950 px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-50">
                          Open shot list
                        </Link>
                        <button type="button" onClick={() => void quickStartTimer("session", item.id, item.title)} className="rounded-full bg-white px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-700">
                          Start timer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Panel>
            <Panel id="sessions-conversion" eyebrow="Conversion" title="Booked from inquiry">
              <div className="space-y-3">
                {asArray(asRecord(dashboard?.conversion).byEventType).slice(0, 6).map((item: LooseRecord) => (
                  <div key={item.eventType} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold capitalize text-stone-950">{String(item.eventType).replace("_", " ")}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-stone-600">
                        {((item.conversionRate ?? 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-stone-600">
                      {item.bookedCount} booked from {item.inquiryCount}
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>
          <section id="studio" className="grid gap-4 xl:grid-cols-[1.05fr,0.95fr]">
            <Panel id="studio-bookings" eyebrow="Creator studio" title="Bookings, access, check-in">
              <div className="space-y-3">
                {asArray(dashboard?.bookings).slice(0, 6).map((item: LooseRecord) => (
                  <div key={item.id} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="font-semibold text-stone-950">{item.purpose || "Studio rental"}</p>
                        <p className="mt-1 text-sm text-stone-600">{shortDate(item.bookingStart)}</p>
                        <p className="mt-1 text-xs text-stone-500">{item.status} • code {item.accessCode || "pending"}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link href={`/studio-booking/${item.id}/check-in`} className="rounded-full bg-stone-950 px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-50">
                          Check-in page
                        </Link>
                        <button type="button" onClick={() => void quickStartTimer("studio_booking", item.id, item.purpose || "Studio booking")} className="rounded-full bg-white px-3 py-2 text-xs uppercase tracking-[0.18em] text-stone-700">
                          Start timer
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  {asArray(dashboard?.spaces).slice(0, 4).map((item: LooseRecord) => (
                    <div key={item.id} className="mt-2 flex items-center justify-between rounded-2xl bg-white px-3 py-3 text-sm first:mt-0">
                      <span>{item.name}</span>
                      <span className="text-stone-500">{money(item.hourlyRateCents)}/hr</span>
                    </div>
                  ))}
                </div>
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  {asArray(dashboard?.equipment).slice(0, 4).map((item: LooseRecord) => (
                    <div key={item.id} className="mt-2 flex items-center justify-between rounded-2xl bg-white px-3 py-3 text-sm first:mt-0">
                      <span>{item.name}</span>
                      <span className="text-stone-500">{item.quantityAvailable}/{item.quantityOwned}</span>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel id="studio-source" eyebrow="Folded source" title="Studio story and rates">
              <p className="text-sm leading-7 text-stone-600">{foldedStudioSource.description}</p>
              <div className="mt-4 grid gap-3">
                {foldedStudioSource.rates.map((rate) => (
                  <div key={rate.label} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-semibold text-stone-950">{rate.label}</p>
                      <span className="font-serif text-2xl text-stone-950">{rate.price}</span>
                    </div>
                    <p className="mt-2 text-sm text-stone-600">{rate.details}</p>
                  </div>
                ))}
              </div>
            </Panel>
          </section>

          <section id="finance" className="grid gap-4 xl:grid-cols-[1.1fr,0.9fr]">
            <Panel id="finance-ops" eyebrow="Financial" title="Revenue, invoices, expenses">
              <div className="grid gap-3 md:grid-cols-3">
                {[
                  ["Photo paid", money(asRecord(asRecord(dashboard?.revenue).totals).photoPaidCents)],
                  ["Studio paid", money(asRecord(asRecord(dashboard?.revenue).totals).studioPaidCents)],
                  ["Profit", money(asRecord(asRecord(dashboard?.profit).totals).profitCents)],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                    <p className="text-[0.68rem] uppercase tracking-[0.24em] text-stone-500">{label}</p>
                    <p className="mt-2 font-serif text-3xl text-stone-950">{value}</p>
                  </div>
                ))}
              </div>
              <div className="mt-5 grid gap-3 lg:grid-cols-2">
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  {asArray(dashboard?.invoices).slice(0, 6).map((item: LooseRecord) => (
                    <div key={item.id} className="mt-2 rounded-2xl bg-white px-3 py-3 text-sm first:mt-0">
                      <div className="flex items-center justify-between gap-3">
                        <span>{item.sourceType}</span>
                        <span className="text-stone-500">{item.status}</span>
                      </div>
                      <p className="mt-1 font-semibold text-stone-950">{money(item.totalCents)}</p>
                      <p className="text-xs text-stone-500">Balance {money(item.balanceCents)}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  {asArray(dashboard?.expenses).slice(0, 6).map((item: LooseRecord) => (
                    <div key={item.id} className="mt-2 rounded-2xl bg-white px-3 py-3 text-sm first:mt-0">
                      <div className="flex items-center justify-between gap-3">
                        <span>{item.category}</span>
                        <span className="text-stone-500">{shortDate(item.spentAt)}</span>
                      </div>
                      <p className="mt-1 font-semibold text-stone-950">{money(item.amountCents)}</p>
                      <p className="text-xs text-stone-500">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel id="finance-stage11" eyebrow="Provider seam" title="Stripe checkout, fallback manual ledger">
              <div className="space-y-3 text-sm leading-7 text-stone-600">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <p className="font-semibold text-stone-950">
                    Provider: {String(asRecord(dashboard?.paymentProvider).provider || "manual")}
                  </p>
                  <p className="text-xs text-stone-500">
                    Mode: {String(asRecord(dashboard?.paymentProvider).mode || "test")} •{" "}
                    {asRecord(dashboard?.paymentProvider).available ? "configured" : "not configured"}
                  </p>
                  {!asRecord(dashboard?.paymentProvider).available ? (
                    <p className="mt-2 text-xs text-amber-700">{String(asRecord(dashboard?.paymentProvider).reason || "")}</p>
                  ) : null}
                </div>
                <p>
                  Manual payment recording remains available for Zelle, cash, checks, Venmo, and offline ACH notes. Stripe now
                  handles hosted checkout client secrets, webhook reconciliation, and refund execution.
                </p>
                <div className="grid gap-3">
                  {asArray(dashboard?.payments).slice(-6).reverse().map((item: LooseRecord) => (
                    <div key={item.id} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-stone-950">
                            {item.method} • {money(item.amountCents)}
                          </p>
                          <p className="text-xs text-stone-500">
                            {shortDate(item.receivedAt)} • {item.providerTransactionId || "manual ledger"}
                          </p>
                        </div>
                        {String(item.method).startsWith("stripe") && Number(item.amountCents) > 0 ? (
                          <button
                            type="button"
                            onClick={() => void refundStripePayment(item.id)}
                            disabled={refundingPaymentId === item.id}
                            className="rounded-2xl border border-stone-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone-900 disabled:opacity-60"
                          >
                            {refundingPaymentId === item.id ? "Refunding" : "Refund"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
          </section>

          <section id="operations" className="grid gap-4 xl:grid-cols-[1fr,1fr]">
            <Panel id="operations-feed" eyebrow="Operations" title="Tasks, inbox, and reminders">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  {asArray(dashboard?.tasks).slice(0, 7).map((item: LooseRecord) => (
                    <div key={item.id} className="mt-2 rounded-2xl bg-white px-3 py-3 text-sm first:mt-0">
                      <p className="font-semibold text-stone-950">{item.title}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.18em] text-stone-500">{item.priority} • {item.status}</p>
                    </div>
                  ))}
                </div>
                <div className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  {asArray(dashboard?.inbox).slice(0, 7).map((item: LooseRecord) => (
                    <div key={item.id} className="mt-2 rounded-2xl bg-white px-3 py-3 text-sm first:mt-0">
                      <p className="font-semibold text-stone-950">{item.subject || item.activityType}</p>
                      <p className="mt-1 text-xs text-stone-500">{shortDate(item.occurredAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Panel>
            <Panel id="operations-mobile" eyebrow="Mobile PWA" title="Field-ready utility routes">
              <div className="grid gap-3">
                {asArray(dashboard?.sessions).slice(0, 3).map((item: LooseRecord) => (
                  <Link key={item.id} href={`/session/${item.id}/shot-list`} className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm transition hover:bg-stone-100">
                    Open shot list: {item.title}
                  </Link>
                ))}
                {asArray(dashboard?.bookings).slice(0, 3).map((item: LooseRecord) => (
                  <Link key={item.id} href={`/studio-booking/${item.id}/check-in`} className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm transition hover:bg-stone-100">
                    Open check-in: {item.purpose || shortDate(item.bookingStart)}
                  </Link>
                ))}
                <div className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                  Recent time: {duration(asRecord(asRecord(dashboard?.time).summary).todayMinutes)} today •{" "}
                  {duration(asRecord(asRecord(dashboard?.time).summary).weekMinutes)} this week
                </div>
              </div>
            </Panel>
          </section>

          {loading ? <div className="rounded-3xl border border-stone-200 bg-white px-4 py-4 text-sm text-stone-500">Refreshing dashboard...</div> : null}
        </div>
      </div>
    </main>
  );
}
