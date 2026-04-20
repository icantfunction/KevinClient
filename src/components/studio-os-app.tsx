// Stage 11.5 Admin App Shell Purpose
"use client";

import Link from "next/link";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from "react";
import { foldedStudioSource } from "@/lib/studio-source";
import { studioOsRuntimeConfig } from "@/lib/studio-os-config";
import { useStudioOsAuth } from "./studio-os-auth-provider";

type LooseRecord = Record<string, any>;
type NavKey =
  | "overview"
  | "pipeline"
  | "sessions"
  | "studio"
  | "finance"
  | "operations"
  | "inbox";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const money = (cents?: number | null) =>
  currencyFormatter.format((cents ?? 0) / 100);

const dayFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const timeFormatter = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

const weekdayFormatter = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
});

const relative = (value?: string | null) => {
  if (!value) return "TBD";
  const then = new Date(value).getTime();
  const delta = then - Date.now();
  const mins = Math.round(delta / 60000);
  const abs = Math.abs(mins);
  if (abs < 60) return mins >= 0 ? `in ${abs}m` : `${abs}m ago`;
  const hrs = Math.round(abs / 60);
  if (hrs < 24) return mins >= 0 ? `in ${hrs}h` : `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return mins >= 0 ? `in ${days}d` : `${days}d ago`;
  return dayFormatter.format(new Date(value));
};

const shortDate = (value?: string | null) => {
  if (!value) return "—";
  const d = new Date(value);
  return `${dayFormatter.format(d)} · ${timeFormatter.format(d)}`;
};

const duration = (minutes?: number) => {
  const safeMinutes = minutes ?? 0;
  const hours = Math.floor(safeMinutes / 60);
  const remainder = safeMinutes % 60;
  return hours > 0 ? `${hours}h ${remainder}m` : `${remainder}m`;
};

const requestKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}`;

const asArray = (value: unknown): LooseRecord[] =>
  Array.isArray(value) ? (value as LooseRecord[]) : [];
const asRecord = (value: unknown): LooseRecord =>
  (value && typeof value === "object" ? value : {}) as LooseRecord;

const initialsOf = (name?: string) =>
  String(name ?? "?")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((piece) => piece[0])
    .join("")
    .toUpperCase() || "?";

type ChipTone =
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "sky"
  | "slate"
  | "indigo";

const chipStyles: Record<ChipTone, string> = {
  emerald: "bg-emerald-100 text-emerald-800",
  amber: "bg-amber-100 text-amber-800",
  rose: "bg-rose-100 text-rose-800",
  violet: "bg-violet-100 text-violet-800",
  sky: "bg-sky-100 text-sky-800",
  slate: "bg-slate-100 text-slate-700",
  indigo: "bg-indigo-100 text-indigo-800",
};

function Chip({
  tone = "slate",
  children,
  className = "",
}: {
  tone?: ChipTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[0.72rem] font-medium ${chipStyles[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

const statusChipTone = (status?: string | null): ChipTone => {
  switch ((status ?? "").toLowerCase()) {
    case "confirmed":
    case "signed":
    case "paid":
    case "delivered":
    case "ready":
    case "completed":
    case "in_use":
      return "emerald";
    case "sent":
    case "in_progress":
    case "processing":
    case "qualifying":
    case "proposal_sent":
      return "sky";
    case "tentative":
    case "partial":
    case "hold":
    case "draft":
      return "amber";
    case "overdue":
    case "no_show":
    case "expired":
    case "failed":
      return "rose";
    case "new":
      return "violet";
    default:
      return "slate";
  }
};

const priorityTone = (priority?: string | null): ChipTone => {
  switch ((priority ?? "").toLowerCase()) {
    case "high":
    case "urgent":
      return "rose";
    case "medium":
      return "amber";
    case "low":
      return "slate";
    default:
      return "slate";
  }
};

const formatStatusLabel = (status?: string | null) =>
  (status ?? "").replace(/_/g, " ");

type IconProps = { className?: string };

const Icon = {
  Home: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
    </svg>
  ),
  Pipeline: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="4" width="5" height="16" rx="1.5" />
      <rect x="10" y="4" width="5" height="10" rx="1.5" />
      <rect x="17" y="4" width="4" height="6" rx="1.5" />
    </svg>
  ),
  Camera: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  Studio: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 10h18M3 10v10h18V10M3 10l9-6 9 6" />
    </svg>
  ),
  Wallet: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 7V5a2 2 0 0 1 2-2h11v4" />
      <circle cx="16" cy="13" r="1.25" />
    </svg>
  ),
  Tasks: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  ),
  Inbox: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <path d="M4 13 6 5h12l2 8" />
      <path d="M4 13h4l1 2h6l1-2h4" />
    </svg>
  ),
  Search: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  Plus: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  Play: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  Stop: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  ),
  Bell: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  ArrowUpRight: ({ className = "h-3.5 w-3.5" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  ),
  ChevronRight: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  ),
};

const navItems: ReadonlyArray<{
  readonly key: NavKey;
  readonly label: string;
  readonly icon: ComponentType<IconProps>;
}> = [
  { key: "overview", label: "Overview", icon: Icon.Home },
  { key: "pipeline", label: "Pipeline", icon: Icon.Pipeline },
  { key: "sessions", label: "Sessions", icon: Icon.Camera },
  { key: "studio", label: "Studio", icon: Icon.Studio },
  { key: "finance", label: "Finance", icon: Icon.Wallet },
  { key: "operations", label: "Tasks", icon: Icon.Tasks },
  { key: "inbox", label: "Inbox", icon: Icon.Inbox },
];

function LoginPanel() {
  const {
    status,
    challengePhoneNumber,
    requestCode,
    verifyCode,
    isWorking,
    errorMessage,
  } = useStudioOsAuth();
  const [phoneNumber, setPhoneNumber] = useState(
    studioOsRuntimeConfig.allowedPhoneNumber,
  );
  const [otpCode, setOtpCode] = useState("");

  const enterDemo = () => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("studio-os-admin-demo-mode-v1", "1");
      window.location.replace("/?demo=1");
    }
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-14">
        <div className="mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
            <span className="font-serif text-lg leading-none">K</span>
          </div>
          <h1 className="mt-6 font-serif text-[2.4rem] leading-[1.05] tracking-tight text-slate-900">
            Studio OS
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Kevin Ramos · photography &amp; creator studio
          </p>
        </div>

        {status !== "challenge" ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void requestCode(phoneNumber);
            }}
          >
            <label className="block">
              <span className="text-xs font-medium text-slate-600">
                Phone number
              </span>
              <input
                className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-[0.95rem] outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
                value={phoneNumber}
                onChange={(event) => setPhoneNumber(event.target.value)}
                inputMode="tel"
                autoComplete="tel"
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              disabled={isWorking}
            >
              {isWorking ? "Sending…" : "Continue"}
            </button>
          </form>
        ) : (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void verifyCode(otpCode);
            }}
          >
            <p className="text-sm text-slate-600">
              Code sent to{" "}
              <span className="font-medium text-slate-900">
                {challengePhoneNumber}
              </span>
              .
            </p>
            <input
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-3 text-center font-mono text-xl tracking-[0.36em] outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10"
              value={otpCode}
              onChange={(event) => setOtpCode(event.target.value)}
              inputMode="numeric"
              maxLength={6}
              autoFocus
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              disabled={isWorking}
            >
              {isWorking ? "Verifying…" : "Sign in"}
            </button>
          </form>
        )}

        {errorMessage ? (
          <p className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {errorMessage}
          </p>
        ) : null}

        <div className="mt-8 flex items-center gap-3 text-xs text-slate-400">
          <span className="h-px flex-1 bg-slate-200" />
          or
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <button
          type="button"
          onClick={enterDemo}
          className="mt-5 w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-800 transition hover:border-slate-400 hover:bg-slate-50"
        >
          View a demo workspace
        </button>

        <p className="mt-10 text-[0.72rem] text-slate-400">
          Temporary OTP <code className="font-mono">999999</code> works for the
          allowlisted number while SNS is sandboxed.
        </p>
      </div>
    </main>
  );
}

function SectionTitle({
  title,
  meta,
  action,
}: {
  readonly title: string;
  readonly meta?: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {meta ? (
          <p className="mt-0.5 text-sm text-slate-500">{meta}</p>
        ) : null}
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

function Card({
  children,
  className = "",
  padding = "p-5",
}: {
  readonly children: ReactNode;
  readonly className?: string;
  readonly padding?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-slate-200 bg-white ${padding} ${className}`}
    >
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly sublabel?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-[1.75rem] font-semibold leading-none text-slate-900">
        {value}
      </p>
      {sublabel ? (
        <p className="mt-1.5 text-[0.78rem] text-slate-500">{sublabel}</p>
      ) : null}
    </div>
  );
}

function EmptyRow({ children }: { readonly children: ReactNode }) {
  return (
    <div className="rounded-md bg-slate-50 px-3 py-5 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}

function PipelineBoard({ inquiries }: { readonly inquiries: LooseRecord[] }) {
  const columns: ReadonlyArray<{
    readonly key: string;
    readonly title: string;
    readonly tone: ChipTone;
  }> = [
    { key: "new", title: "New", tone: "violet" },
    { key: "qualifying", title: "Qualifying", tone: "sky" },
    { key: "proposal_sent", title: "Proposal sent", tone: "amber" },
    { key: "won", title: "Booked", tone: "emerald" },
  ];
  const bucket = (status?: string): string => {
    const s = (status ?? "").toLowerCase();
    if (s === "proposal_sent") return "proposal_sent";
    if (s === "qualifying") return "qualifying";
    if (s === "booked" || s === "won") return "won";
    return "new";
  };

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {columns.map((col) => {
        const rows = inquiries.filter(
          (item) => bucket(item.status as string | undefined) === col.key,
        );
        return (
          <div
            key={col.key}
            className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
          >
            <div className="flex items-center justify-between px-1 pb-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${col.tone === "violet" ? "bg-violet-500" : col.tone === "sky" ? "bg-sky-500" : col.tone === "amber" ? "bg-amber-500" : "bg-emerald-500"}`} />
                <span className="text-sm font-medium text-slate-700">
                  {col.title}
                </span>
                <span className="text-xs text-slate-400">{rows.length}</span>
              </div>
              <button
                type="button"
                aria-label={`Add to ${col.title}`}
                className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <Icon.Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {rows.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-200 bg-white/60 py-4 text-center text-xs text-slate-400">
                  —
                </div>
              ) : (
                rows.map((item) => (
                  <div
                    key={String(item.id)}
                    className="group cursor-pointer rounded-lg border border-slate-200 bg-white p-3 transition hover:border-slate-300"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900">
                        {String(item.inquirerName ?? "Unknown")}
                      </p>
                      <Chip tone="slate">
                        {formatStatusLabel(item.eventType as string)}
                      </Chip>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-slate-500">
                      {String(item.message ?? "")}
                    </p>
                    <p className="mt-2 text-[0.7rem] text-slate-400">
                      {relative(item.receivedAt as string)}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
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
  const [refundingPaymentId, setRefundingPaymentId] = useState<string | null>(
    null,
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [activeNav, setActiveNav] = useState<NavKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const deferredSearch = useDeferredValue(searchInput);

  const loadDashboard = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const year = new Date().getUTCFullYear();
      const range = `from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + 14 * 86400000).toISOString())}`;
      const requests = await Promise.all([
        authorizedFetch("/dashboard").then((r) => r.json()),
        authorizedFetch("/inquiries?limit=12").then((r) => r.json()),
        authorizedFetch("/sessions?limit=12").then((r) => r.json()),
        authorizedFetch(`/calendar?${range}`).then((r) => r.json()),
        authorizedFetch("/smart-files").then((r) => r.json()),
        authorizedFetch("/galleries").then((r) => r.json()),
        authorizedFetch("/studio/bookings").then((r) => r.json()),
        authorizedFetch("/studio/spaces").then((r) => r.json()),
        authorizedFetch("/studio/equipment").then((r) => r.json()),
        authorizedFetch("/invoices").then((r) => r.json()),
        authorizedFetch("/payments?limit=12").then((r) => r.json()),
        authorizedFetch("/payments/provider").then((r) => r.json()),
        authorizedFetch("/expenses").then((r) => r.json()),
        authorizedFetch("/tasks?limit=12").then((r) => r.json()),
        authorizedFetch("/inbox").then((r) => r.json()),
        authorizedFetch(`/reports/revenue?year=${year}`).then((r) => r.json()),
        authorizedFetch(`/reports/profit?year=${year}`).then((r) => r.json()),
        authorizedFetch(`/reports/conversion`).then((r) => r.json()),
        authorizedFetch(`/reports/ltv`).then((r) => r.json()),
        authorizedFetch("/time-entries?limit=12").then((r) => r.json()),
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
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [authorizedFetch, status]);

  const loadDashboardRef = useRef(loadDashboard);
  loadDashboardRef.current = loadDashboard;

  useEffect(() => {
    if (status === "authenticated") {
      void loadDashboardRef.current();
    }
  }, [status]);

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
          setSearchResults(
            asArray(asRecord(payload).results) as LooseRecord[],
          );
        }
      })
      .catch(() => {
        if (!cancelled) setSearchResults([]);
      });

    return () => {
      cancelled = true;
    };
  }, [deferredSearch, status]);

  useEffect(() => {
    const interval = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const activeEntry = asRecord(
    asRecord(asRecord(dashboard?.time).summary).activeEntry,
  );
  const activeMinutes = activeEntry.startedAt
    ? Math.max(
        0,
        Math.round(
          (nowTick - new Date(String(activeEntry.startedAt)).getTime()) / 60000,
        ),
      )
    : 0;
  const upcomingSessions = asArray(
    asRecord(dashboard?.summary).upcoming_sessions,
  ).length
    ? asArray(asRecord(dashboard?.summary).upcoming_sessions)
    : asArray(asRecord(dashboard?.summary).upcomingSessions);

  const quickStartTimer = async (
    scope = timeScope,
    scopeId?: string,
    title = timeTitle,
  ) => {
    if (!title.trim()) {
      setErrorMessage("A timer title is required.");
      return;
    }

    await authorizedFetch("/time-entries", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": requestKey(),
      },
      body: JSON.stringify({
        scope,
        scopeId: scopeId ?? null,
        title: title.trim(),
        notes: timeNotes.trim() || null,
      }),
    });

    setTimeTitle("");
    setTimeNotes("");
    setTimeScope("admin");
    await loadDashboard();
  };

  const stopTimer = async () => {
    if (!activeEntry.id) return;
    await authorizedFetch(`/time-entries/${activeEntry.id}/stop`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "Idempotency-Key": requestKey(),
      },
      body: JSON.stringify({
        notes: timeNotes.trim() || activeEntry.notes || null,
      }),
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
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": requestKey(),
        },
        body: JSON.stringify({}),
      });
      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to refund payment.",
      );
    } finally {
      setRefundingPaymentId(null);
    }
  };

  const kpis = useMemo(() => {
    const newInquiries = Number(
      asRecord(dashboard?.summary).new_inquiry_count ??
        asArray(dashboard?.inquiries).filter(
          (i) => (i.status as string) === "new",
        ).length ??
        0,
    );
    const activeSessions = Number(
      asRecord(dashboard?.summary).active_session_count ??
        asArray(dashboard?.sessions).length ??
        0,
    );
    const openTasks = Number(
      asRecord(dashboard?.summary).open_task_count ??
        asArray(dashboard?.tasks).filter(
          (t) => (t.status as string) !== "completed",
        ).length ??
        0,
    );
    const outstandingCents = Number(
      asRecord(asRecord(dashboard?.revenue).totals).outstandingCents ??
        asRecord(dashboard?.summary).outstanding_invoice_cents ??
        asArray(dashboard?.invoices).reduce(
          (sum, inv) => sum + Number((inv as LooseRecord).balanceCents ?? 0),
          0,
        ),
    );
    return [
      {
        label: "New inquiries",
        value: String(newInquiries),
        sublabel: "awaiting response",
      },
      {
        label: "Upcoming sessions",
        value: String(activeSessions),
        sublabel: "next 14 days",
      },
      {
        label: "Open tasks",
        value: String(openTasks),
        sublabel: asArray(dashboard?.tasks).filter(
          (t) => (t.priority as string) === "high",
        ).length
          ? `${asArray(dashboard?.tasks).filter((t) => (t.priority as string) === "high").length} high priority`
          : undefined,
      },
      {
        label: "Outstanding",
        value: money(outstandingCents),
        sublabel: `${
          asArray(dashboard?.invoices).filter(
            (inv) => Number(inv.balanceCents ?? 0) > 0,
          ).length
        } open invoices`,
      },
    ];
  }, [dashboard]);

  if (status !== "authenticated" || !session) {
    return <LoginPanel />;
  }

  const isDemo = Boolean((session as LooseRecord).demoMode);

  const topProvider = asRecord(dashboard?.paymentProvider);
  const providerAvailable = Boolean(topProvider.available);

  const overdueInvoices = asArray(dashboard?.invoices).filter(
    (inv) => (inv.status as string) === "overdue",
  ).length;

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-14 items-center gap-2.5 px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-900 text-white">
            <span className="font-serif text-sm leading-none">K</span>
          </div>
          <span className="text-[0.95rem] font-semibold tracking-tight text-slate-900">
            Studio OS
          </span>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 pb-4">
          <div className="px-2 pb-1.5 pt-2 text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">
            Workspace
          </div>
          <ul className="space-y-0.5">
            {navItems.map((item) => {
              const NavIcon = item.icon;
              const isActive = activeNav === item.key;
              return (
                <li key={item.key}>
                  <a
                    href={`#${item.key}`}
                    onClick={() => {
                      setActiveNav(item.key);
                      setSidebarOpen(false);
                    }}
                    className={`flex items-center gap-3 rounded-md px-2.5 py-1.5 text-sm transition ${
                      isActive
                        ? "bg-slate-100 font-medium text-slate-900"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <NavIcon
                      className={`h-4 w-4 ${isActive ? "text-slate-900" : "text-slate-400"}`}
                    />
                    <span>{item.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 px-2 pb-1.5 text-[0.68rem] font-medium uppercase tracking-wider text-slate-400">
            Links
          </div>
          <ul className="space-y-0.5">
            <li>
              <Link
                href="/studio"
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <span>Studio page</span>
                <Icon.ChevronRight className="h-3.5 w-3.5 text-slate-400" />
              </Link>
            </li>
            <li>
              <a
                href={`${studioOsRuntimeConfig.apiUrl}/studio/page`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-md px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
              >
                <span>Public studio</span>
                <Icon.ArrowUpRight className="h-3.5 w-3.5 text-slate-400" />
              </a>
            </li>
          </ul>
        </nav>

        <div className="border-t border-slate-200 p-2.5">
          <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[0.72rem] font-semibold text-slate-700">
              {isDemo ? "DM" : "KR"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-900">
                {isDemo ? "Demo workspace" : "Kevin Ramos"}
              </p>
              <p className="truncate text-[0.7rem] text-slate-500">
                {session.phoneNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex-shrink-0 rounded p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Sign out"
              title="Sign out"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M15 12H3m0 0 4-4m-4 4 4 4" />
                <path d="M9 5V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2v-1" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Main */}
      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 lg:hidden"
              aria-label="Toggle navigation"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="relative w-full max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400">
                <Icon.Search className="h-4 w-4" />
              </div>
              <input
                className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:ring-2 focus:ring-slate-900/5"
                placeholder="Search clients, sessions, invoices…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchResults.length > 0 ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
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
                      className="flex items-center justify-between gap-3 px-3 py-2 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {String(result.title)}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {String(result.subtitle || "")}
                        </p>
                      </div>
                      <span className="text-xs text-slate-400">
                        {formatStatusLabel(result.entityType as string)}
                      </span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-1.5">
              {activeEntry.id ? (
                <button
                  type="button"
                  onClick={() => void stopTimer()}
                  className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                  title="Stop timer"
                >
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-rose-500" />
                  </span>
                  <span className="font-mono">{duration(activeMinutes)}</span>
                  <span className="hidden max-w-[160px] truncate sm:inline">
                    {String(activeEntry.title)}
                  </span>
                </button>
              ) : null}

              <button
                type="button"
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800"
                aria-label="Notifications"
              >
                <Icon.Bell />
                {overdueInvoices > 0 ? (
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
                ) : null}
              </button>

              {isDemo ? (
                <span className="hidden items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[0.68rem] font-medium text-amber-800 sm:inline-flex">
                  Demo data
                </span>
              ) : null}
            </div>
          </div>
        </header>

        <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
          {/* Overview */}
          <section id="overview" className="scroll-mt-20 space-y-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <h1 className="mt-0.5 text-2xl font-semibold tracking-tight text-slate-900">
                  Overview
                </h1>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Icon.Plus className="h-3 w-3" />
                  Inquiry
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800"
                >
                  <Icon.Plus className="h-3 w-3" />
                  Session
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {kpis.map((kpi) => (
                <StatCard
                  key={kpi.label}
                  label={kpi.label}
                  value={kpi.value}
                  sublabel={kpi.sublabel}
                />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Card padding="p-0">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <SectionTitle title="Coming up" />
                  <a
                    href="#sessions"
                    className="text-xs font-medium text-slate-500 hover:text-slate-900"
                  >
                    All sessions →
                  </a>
                </div>
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {upcomingSessions.length === 0 ? (
                    <div className="px-5 py-6 text-sm text-slate-400">
                      Nothing scheduled in the next two weeks.
                    </div>
                  ) : (
                    upcomingSessions.slice(0, 5).map((item: LooseRecord) => {
                      const start = item.scheduledStart ?? item.scheduled_start;
                      return (
                        <div
                          key={String(item.id)}
                          className="group flex items-center gap-4 px-5 py-3 transition hover:bg-slate-50/60"
                        >
                          <div className="flex h-11 w-11 flex-col items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                            <span className="text-[0.58rem] font-semibold uppercase tracking-wider text-slate-500">
                              {start
                                ? weekdayFormatter.format(new Date(start))
                                : "—"}
                            </span>
                            <span className="text-base font-semibold leading-none">
                              {start ? new Date(start).getDate() : "·"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {String(item.title)}
                            </p>
                            <p className="mt-0.5 truncate text-xs text-slate-500">
                              {String(item.locationName ?? "Location TBD")}
                              {" · "}
                              {shortDate(start as string)}
                            </p>
                          </div>
                          <Chip tone={statusChipTone(item.status as string)}>
                            {formatStatusLabel(item.status as string) ||
                              "scheduled"}
                          </Chip>
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>

              <Card>
                <SectionTitle
                  title="Timer"
                  meta={
                    activeEntry.id
                      ? `Running · ${duration(activeMinutes)}`
                      : undefined
                  }
                />
                {activeEntry.id ? (
                  <div className="mt-4 space-y-3">
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                      <p className="text-sm font-medium text-slate-900">
                        {String(activeEntry.title)}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        Started {shortDate(activeEntry.startedAt as string)}
                      </p>
                    </div>
                    <textarea
                      className="min-h-[72px] w-full resize-none rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
                      value={timeNotes}
                      onChange={(event) => setTimeNotes(event.target.value)}
                      placeholder="Notes before stopping"
                    />
                    <button
                      type="button"
                      onClick={() => void stopTimer()}
                      className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Stop timer
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-3">
                    <input
                      className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-900/5"
                      value={timeTitle}
                      onChange={(event) => setTimeTitle(event.target.value)}
                      placeholder="What are you working on?"
                    />
                    <div className="flex flex-wrap gap-1">
                      {[
                        ["admin", "Admin"],
                        ["session", "Session"],
                        ["studio_booking", "Studio"],
                        ["standalone", "Other"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTimeScope(value)}
                          className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${timeScope === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void quickStartTimer()}
                      className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                    >
                      Start
                    </button>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-sm">
                  <div>
                    <p className="text-[0.72rem] text-slate-500">Today</p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      {duration(
                        asRecord(asRecord(dashboard?.time).summary)
                          .todayMinutes as number,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.72rem] text-slate-500">This week</p>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      {duration(
                        asRecord(asRecord(dashboard?.time).summary)
                          .weekMinutes as number,
                      )}
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          </section>

          {errorMessage ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {/* Pipeline */}
          <section id="pipeline" className="scroll-mt-20 space-y-4">
            <SectionTitle
              title="Pipeline"
              action={
                <>
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Filter
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    Inquiry
                  </button>
                </>
              }
            />
            <PipelineBoard inquiries={asArray(dashboard?.inquiries)} />

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card padding="p-0">
                <div className="px-5 py-3.5">
                  <SectionTitle title="Smart files" />
                </div>
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {asArray(dashboard?.smartFiles).slice(0, 6).length === 0 ? (
                    <div className="px-5 py-6 text-sm text-slate-400">
                      No smart files in flight.
                    </div>
                  ) : (
                    asArray(dashboard?.smartFiles)
                      .slice(0, 6)
                      .map((item: LooseRecord) => (
                        <div
                          key={String(item.id)}
                          className="flex items-center justify-between gap-3 px-5 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">
                              {String(item.title)}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {String(
                                item.recipientEmail ??
                                  item.recipient_email ??
                                  "No recipient",
                              )}
                            </p>
                          </div>
                          <Chip tone={statusChipTone(item.status as string)}>
                            {formatStatusLabel(item.status as string)}
                          </Chip>
                        </div>
                      ))
                  )}
                </div>
              </Card>

              <Card padding="p-0">
                <div className="px-5 py-3.5">
                  <SectionTitle title="Top clients by LTV" />
                </div>
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {asArray(asRecord(dashboard?.ltv).clients)
                    .slice(0, 5)
                    .map((item: LooseRecord, idx) => (
                      <div
                        key={String(item.clientId ?? idx)}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                          {initialsOf(String(item.name))}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {String(item.name)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {money(item.lifetimeValueCents as number)}
                          </p>
                        </div>
                        {item.repeatBookingLikely ? (
                          <Chip tone="emerald">repeat</Chip>
                        ) : null}
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </section>

          {/* Sessions */}
          <section id="sessions" className="scroll-mt-20 space-y-4">
            <SectionTitle
              title="Sessions"
              action={
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <Icon.Plus className="h-3 w-3" />
                  Session
                </button>
              }
            />

            <Card padding="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-100 text-left text-[0.72rem] font-medium uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="px-5 py-2.5">Session</th>
                      <th className="px-5 py-2.5">Date</th>
                      <th className="px-5 py-2.5">Client</th>
                      <th className="px-5 py-2.5">Status</th>
                      <th className="px-5 py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {asArray(dashboard?.sessions).length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <div className="px-5 py-6 text-sm text-slate-400">
                            No sessions yet.
                          </div>
                        </td>
                      </tr>
                    ) : (
                      asArray(dashboard?.sessions)
                        .slice(0, 8)
                        .map((item: LooseRecord) => (
                          <tr
                            key={String(item.id)}
                            className="transition hover:bg-slate-50/60"
                          >
                            <td className="px-5 py-3">
                              <p className="font-medium text-slate-900">
                                {String(item.title)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatStatusLabel(
                                  item.sessionType as string,
                                ) || "session"}
                                {" · "}
                                {String(item.locationName ?? "Location TBD")}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-slate-700">
                              <p className="whitespace-nowrap">
                                {shortDate(item.scheduledStart as string)}
                              </p>
                              <p className="text-xs text-slate-400">
                                {relative(item.scheduledStart as string)}
                              </p>
                            </td>
                            <td className="px-5 py-3 text-slate-700">
                              {String(item.clientName ?? "—")}
                            </td>
                            <td className="px-5 py-3">
                              <Chip tone={statusChipTone(item.status as string)}>
                                {formatStatusLabel(item.status as string) ||
                                  "scheduled"}
                              </Chip>
                            </td>
                            <td className="px-5 py-3 text-right">
                              <div className="inline-flex items-center gap-1">
                                <Link
                                  href={`/session/${item.id}/shot-list`}
                                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[0.72rem] font-medium text-slate-700 transition hover:border-slate-300"
                                >
                                  Shot list
                                </Link>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void quickStartTimer(
                                      "session",
                                      String(item.id),
                                      String(item.title),
                                    )
                                  }
                                  className="rounded-md bg-slate-900 px-2 py-1 text-[0.72rem] font-medium text-white transition hover:bg-slate-800"
                                >
                                  Timer
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            <div>
              <SectionTitle title="Conversion by type" />
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {asArray(asRecord(dashboard?.conversion).byEventType)
                  .slice(0, 4)
                  .map((item: LooseRecord) => {
                    const rate = Number(item.conversionRate ?? 0);
                    const pct = Math.round(rate * 100);
                    return (
                      <div
                        key={String(item.eventType)}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium capitalize text-slate-900">
                            {formatStatusLabel(item.eventType as string)}
                          </p>
                          <span className="text-sm font-semibold text-slate-900">
                            {pct}%
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {Number(item.bookedCount ?? 0)} booked of{" "}
                          {Number(item.inquiryCount ?? 0)}
                        </p>
                        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-slate-900"
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          </section>

          {/* Studio */}
          <section id="studio" className="scroll-mt-20 space-y-4">
            <SectionTitle title="Studio" />

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card padding="p-0">
                <div className="px-5 py-3.5">
                  <SectionTitle title="Bookings" />
                </div>
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {asArray(dashboard?.bookings)
                    .slice(0, 6)
                    .map((item: LooseRecord) => (
                      <div
                        key={String(item.id)}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <div className="flex h-10 w-10 flex-shrink-0 flex-col items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                          <span className="text-[0.56rem] font-semibold uppercase tracking-wider text-slate-500">
                            {item.bookingStart
                              ? weekdayFormatter.format(
                                  new Date(item.bookingStart as string),
                                )
                              : "—"}
                          </span>
                          <span className="text-sm font-semibold leading-none">
                            {item.bookingStart
                              ? new Date(item.bookingStart as string).getDate()
                              : "·"}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {String(item.purpose ?? "Studio rental")}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {shortDate(item.bookingStart as string)}
                            {" · code "}
                            <span className="font-mono text-slate-700">
                              {String(item.accessCode ?? "—")}
                            </span>
                          </p>
                        </div>
                        <Chip tone={statusChipTone(item.status as string)}>
                          {formatStatusLabel(item.status as string)}
                        </Chip>
                        <Link
                          href={`/studio-booking/${item.id}/check-in`}
                          className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[0.72rem] font-medium text-slate-700 transition hover:border-slate-300"
                        >
                          Check-in
                        </Link>
                      </div>
                    ))}
                </div>
              </Card>

              <div className="grid gap-4">
                <Card padding="p-0">
                  <div className="px-5 py-3.5">
                    <SectionTitle title="Spaces" />
                  </div>
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {asArray(dashboard?.spaces)
                      .slice(0, 4)
                      .map((item: LooseRecord) => (
                        <div
                          key={String(item.id)}
                          className="flex items-center justify-between px-5 py-2.5 text-sm"
                        >
                          <span className="text-slate-900">
                            {String(item.name)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {money(item.hourlyRateCents as number)}/hr
                          </span>
                        </div>
                      ))}
                  </div>
                </Card>
                <Card padding="p-0">
                  <div className="px-5 py-3.5">
                    <SectionTitle title="Equipment" />
                  </div>
                  <div className="divide-y divide-slate-100 border-t border-slate-100">
                    {asArray(dashboard?.equipment)
                      .slice(0, 5)
                      .map((item: LooseRecord) => {
                        const owned = Number(item.quantityOwned ?? 0);
                        const avail = Number(item.quantityAvailable ?? 0);
                        const out = owned - avail;
                        return (
                          <div
                            key={String(item.id)}
                            className="flex items-center justify-between px-5 py-2.5 text-sm"
                          >
                            <span className="text-slate-900">
                              {String(item.name)}
                            </span>
                            <div className="flex items-center gap-2">
                              {out > 0 ? (
                                <Chip tone="amber">{out} out</Chip>
                              ) : null}
                              <span className="font-mono text-xs text-slate-500">
                                {avail}/{owned}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </Card>
              </div>
            </div>

            <Card>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs text-slate-500">Public listing</p>
                  <h3 className="mt-0.5 text-lg font-semibold text-slate-900">
                    {foldedStudioSource.name}
                  </h3>
                </div>
                <Link
                  href="/studio"
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Preview
                  <Icon.ArrowUpRight />
                </Link>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {foldedStudioSource.rates.map((rate) => (
                  <div
                    key={rate.label}
                    className="rounded-lg border border-slate-200 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-slate-900">
                        {rate.label}
                      </p>
                      <span className="text-sm font-semibold text-slate-900">
                        {rate.price}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-slate-500">
                      {rate.details}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {/* Finance */}
          <section id="finance" className="scroll-mt-20 space-y-4">
            <SectionTitle title="Finance" />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Photo revenue"
                value={money(
                  asRecord(asRecord(dashboard?.revenue).totals)
                    .photoPaidCents as number,
                )}
                sublabel={`${new Date().getUTCFullYear()} YTD`}
              />
              <StatCard
                label="Studio revenue"
                value={money(
                  asRecord(asRecord(dashboard?.revenue).totals)
                    .studioPaidCents as number,
                )}
                sublabel={`${new Date().getUTCFullYear()} YTD`}
              />
              <StatCard
                label="Outstanding"
                value={money(
                  asRecord(asRecord(dashboard?.revenue).totals)
                    .outstandingCents as number,
                )}
                sublabel="all open invoices"
              />
              <StatCard
                label="Profit"
                value={money(
                  asRecord(asRecord(dashboard?.profit).totals)
                    .profitCents as number,
                )}
                sublabel="revenue − expenses"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card padding="p-0">
                <div className="flex items-center justify-between px-5 py-3.5">
                  <SectionTitle title="Invoices" />
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    Invoice
                  </button>
                </div>
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="text-left text-[0.72rem] font-medium uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="px-5 py-2.5">Client</th>
                        <th className="px-5 py-2.5">Type</th>
                        <th className="px-5 py-2.5 text-right">Total</th>
                        <th className="px-5 py-2.5 text-right">Balance</th>
                        <th className="px-5 py-2.5">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 border-t border-slate-100">
                      {asArray(dashboard?.invoices)
                        .slice(0, 6)
                        .map((item: LooseRecord) => (
                          <tr
                            key={String(item.id)}
                            className="transition hover:bg-slate-50/60"
                          >
                            <td className="px-5 py-3 font-medium text-slate-900">
                              {String(
                                item.clientName ??
                                  item.client_name ??
                                  item.clientId ??
                                  "—",
                              )}
                            </td>
                            <td className="px-5 py-3 text-slate-600">
                              {formatStatusLabel(item.sourceType as string)}
                            </td>
                            <td className="px-5 py-3 text-right font-mono text-slate-900">
                              {money(item.totalCents as number)}
                            </td>
                            <td className="px-5 py-3 text-right font-mono text-slate-700">
                              {money(item.balanceCents as number)}
                            </td>
                            <td className="px-5 py-3">
                              <Chip tone={statusChipTone(item.status as string)}>
                                {formatStatusLabel(item.status as string)}
                              </Chip>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-slate-500">Provider</p>
                    <p className="mt-0.5 text-lg font-semibold capitalize text-slate-900">
                      {String(topProvider.provider ?? "manual")}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Mode {String(topProvider.mode ?? "test")}
                    </p>
                  </div>
                  <Chip tone={providerAvailable ? "emerald" : "amber"}>
                    {providerAvailable ? "active" : "manual only"}
                  </Chip>
                </div>
                {!providerAvailable ? (
                  <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {String(
                      topProvider.reason ??
                        "Stripe secret missing; manual ledger only.",
                    )}
                  </p>
                ) : null}

                <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
                  <p className="text-xs font-medium text-slate-500">
                    Recent payments
                  </p>
                  {asArray(dashboard?.payments)
                    .slice(-5)
                    .reverse()
                    .map((item: LooseRecord) => (
                      <div
                        key={String(item.id)}
                        className="flex items-center justify-between gap-3 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">
                            {money(item.amountCents as number)}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {formatStatusLabel(item.method as string)}
                            {" · "}
                            {relative(item.receivedAt as string)}
                          </p>
                        </div>
                        {String(item.method).startsWith("stripe") &&
                        Number(item.amountCents) > 0 ? (
                          <button
                            type="button"
                            onClick={() =>
                              void refundStripePayment(String(item.id))
                            }
                            disabled={refundingPaymentId === item.id}
                            className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[0.7rem] font-medium text-slate-700 transition hover:border-slate-300 disabled:opacity-50"
                          >
                            {refundingPaymentId === item.id
                              ? "…"
                              : "Refund"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                </div>
              </Card>
            </div>

            <Card padding="p-0">
              <div className="px-5 py-3.5">
                <SectionTitle title="Recent expenses" />
              </div>
              <div className="grid gap-0 divide-y divide-slate-100 border-t border-slate-100 md:grid-cols-2 md:divide-x md:divide-y-0">
                {asArray(dashboard?.expenses)
                  .slice(0, 6)
                  .reduce<LooseRecord[][]>((cols, item, i) => {
                    const col = i % 2;
                    (cols[col] ??= []).push(item);
                    return cols;
                  }, [])
                  .map((col, colIndex) => (
                    <div
                      key={colIndex}
                      className="divide-y divide-slate-100"
                    >
                      {col.map((item) => (
                        <div
                          key={String(item.id)}
                          className="flex items-center justify-between px-5 py-3 text-sm"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">
                              {String(item.description)}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {formatStatusLabel(item.category as string)}
                              {" · "}
                              {relative(item.spentAt as string)}
                            </p>
                          </div>
                          <span className="font-mono text-slate-900">
                            {money(item.amountCents as number)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
              </div>
            </Card>
          </section>

          {/* Operations */}
          <section id="operations" className="scroll-mt-20 space-y-4">
            <SectionTitle title="Tasks" />

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {(["open", "in_progress", "completed"] as const).map((state) => {
                const rows = asArray(dashboard?.tasks).filter((t) =>
                  state === "completed"
                    ? (t.status as string) === "completed"
                    : state === "in_progress"
                      ? (t.status as string) === "in_progress"
                      : (t.status as string) === "open" || !t.status,
                );
                const dotColor =
                  state === "open"
                    ? "bg-violet-500"
                    : state === "in_progress"
                      ? "bg-sky-500"
                      : "bg-emerald-500";
                return (
                  <div
                    key={state}
                    className="rounded-xl border border-slate-200 bg-slate-50/60 p-3"
                  >
                    <div className="flex items-center justify-between px-1 pb-2.5">
                      <div className="flex items-center gap-2">
                        <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
                        <span className="text-sm font-medium text-slate-700">
                          {formatStatusLabel(state)}
                        </span>
                        <span className="text-xs text-slate-400">
                          {rows.length}
                        </span>
                      </div>
                      <button
                        type="button"
                        aria-label="Add task"
                        className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                      >
                        <Icon.Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {rows.length === 0 ? (
                        <div className="rounded-md border border-dashed border-slate-200 bg-white/60 py-4 text-center text-xs text-slate-400">
                          —
                        </div>
                      ) : (
                        rows.slice(0, 8).map((item: LooseRecord) => (
                          <div
                            key={String(item.id)}
                            className="rounded-lg border border-slate-200 bg-white p-3"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium text-slate-900">
                                {String(item.title)}
                              </p>
                              {item.priority &&
                              String(item.priority).toLowerCase() !==
                                "low" ? (
                                <Chip
                                  tone={priorityTone(item.priority as string)}
                                >
                                  {String(item.priority)}
                                </Chip>
                              ) : null}
                            </div>
                            {item.dueAt ? (
                              <p className="mt-1.5 text-xs text-slate-500">
                                Due {relative(item.dueAt as string)}
                              </p>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Inbox */}
          <section id="inbox" className="scroll-mt-20 space-y-4">
            <SectionTitle title="Activity" />
            <Card padding="p-0">
              <ul className="divide-y divide-slate-100">
                {asArray(dashboard?.inbox).length === 0 ? (
                  <li className="px-5 py-6 text-sm text-slate-400">
                    Nothing new.
                  </li>
                ) : (
                  asArray(dashboard?.inbox).slice(0, 8).map((item: LooseRecord) => (
                    <li
                      key={String(item.id)}
                      className="flex items-center justify-between gap-3 px-5 py-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {String(
                            item.subject ?? item.activityType ?? "Activity",
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {formatStatusLabel(item.activityType as string)}
                        </p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-slate-400">
                        {relative(item.occurredAt as string)}
                      </span>
                    </li>
                  ))
                )}
              </ul>
            </Card>
          </section>

          {loading ? (
            <div className="text-xs text-slate-500">Syncing…</div>
          ) : null}

          <footer className="border-t border-slate-200 pt-6 text-center text-xs text-slate-400">
            Studio OS · {new Date().getFullYear()}
          </footer>
        </div>
      </div>
    </main>
  );
}
