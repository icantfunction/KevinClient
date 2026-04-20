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
  return `${weekdayFormatter.format(d)} ${dayFormatter.format(d)} · ${timeFormatter.format(d)}`;
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

type ChipTone =
  | "emerald"
  | "amber"
  | "rose"
  | "violet"
  | "sky"
  | "slate"
  | "indigo";

const chipStyles: Record<ChipTone, string> = {
  emerald: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  rose: "bg-rose-50 text-rose-700 ring-rose-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  sky: "bg-sky-50 text-sky-700 ring-sky-200",
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  indigo: "bg-indigo-50 text-indigo-700 ring-indigo-200",
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.08em] ring-1 ring-inset ${chipStyles[tone]} ${className}`}
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />
    </svg>
  ),
  Pipeline: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 6h6M4 12h10M4 18h6" />
      <circle cx="18" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <circle cx="14" cy="12" r="2" />
    </svg>
  ),
  Camera: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 8h3l2-2h6l2 2h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  ),
  Studio: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 10h18M3 10v10h18V10M3 10l9-6 9 6" />
    </svg>
  ),
  Wallet: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <path d="M3 7V5a2 2 0 0 1 2-2h11v4" />
      <circle cx="16" cy="13" r="1.5" />
    </svg>
  ),
  Tasks: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="4" width="16" height="16" rx="3" />
      <path d="m8 12 3 3 5-6" />
    </svg>
  ),
  Inbox: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 13v5a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5" />
      <path d="M4 13 6 5h12l2 8" />
      <path d="M4 13h4l1 2h6l1-2h4" />
    </svg>
  ),
  Search: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  ),
  Plus: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </svg>
  ),
  ArrowUpRight: ({ className = "h-3.5 w-3.5" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M7 17 17 7M9 7h8v8" />
    </svg>
  ),
  Sparkle: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 3 14 10 21 12 14 14 12 21 10 14 3 12 10 10z" />
    </svg>
  ),
};

const navItems: ReadonlyArray<{
  readonly key: NavKey;
  readonly label: string;
  readonly icon: ComponentType<IconProps>;
}> = [
  { key: "overview", label: "Home", icon: Icon.Home },
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
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-6 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 p-10 text-slate-100 shadow-[0_40px_120px_-30px_rgba(15,23,42,0.45)]">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-sky-500/15 blur-3xl" />
          <div className="relative flex h-full flex-col">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                <Icon.Sparkle className="h-4 w-4 text-amber-200" />
              </div>
              <span className="text-[0.72rem] font-semibold uppercase tracking-[0.28em] text-slate-300">
                Studio OS · Beta
              </span>
            </div>
            <h1 className="mt-14 max-w-xl font-serif text-5xl leading-[1.02] tracking-tight lg:text-6xl">
              One backend.
              <br />
              <span className="text-indigo-200">Every operator surface.</span>
            </h1>
            <p className="mt-6 max-w-md text-[0.95rem] leading-relaxed text-slate-300">
              Inquiries, sessions, smart files, galleries, studio bookings,
              invoices, expenses, automations, and field-ready mobile — all on
              the same AWS stack.
            </p>
            <div className="mt-12 grid grid-cols-2 gap-3 text-sm text-slate-200 sm:grid-cols-3">
              {[
                "Cognito OTP",
                "Aurora v2",
                "EventBridge",
                "Stripe",
                "SES · SNS",
                "Fargate",
              ].map((label) => (
                <div
                  key={label}
                  className="rounded-xl bg-white/5 px-3 py-2 text-[0.78rem] font-medium ring-1 ring-white/10 backdrop-blur"
                >
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-auto pt-12 text-xs text-slate-400">
              API: {studioOsRuntimeConfig.apiUrl}
            </div>
          </div>
        </section>

        <section className="rounded-[2rem] bg-white p-8 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.25)] ring-1 ring-slate-200/70">
          <div className="flex items-center justify-between">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Sign in
            </p>
            <Chip tone="emerald">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              API live
            </Chip>
          </div>
          <h2 className="mt-3 font-serif text-3xl text-slate-900">
            Kevin-only phone OTP
          </h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Custom Cognito challenge. Temporary override for{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.78rem] text-slate-700">
              +1 954 854 1484
            </code>{" "}
            accepts <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[0.78rem] text-slate-700">999999</code> while SNS is sandboxed.
          </p>

          {status !== "challenge" ? (
            <form
              className="mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void requestCode(phoneNumber);
              }}
            >
              <label className="block">
                <span className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Phone number
                </span>
                <input
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-[0.95rem] outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                  value={phoneNumber}
                  onChange={(event) => setPhoneNumber(event.target.value)}
                  inputMode="tel"
                  autoComplete="tel"
                />
              </label>
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                disabled={isWorking}
              >
                {isWorking ? "Sending code…" : "Send one-time code"}
                <Icon.ArrowUpRight />
              </button>
            </form>
          ) : (
            <form
              className="mt-8 space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void verifyCode(otpCode);
              }}
            >
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Code sent to{" "}
                <span className="font-semibold text-slate-900">
                  {challengePhoneNumber}
                </span>
                . Enter the 6-digit code.
              </div>
              <input
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center font-mono text-2xl tracking-[0.42em] outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                value={otpCode}
                onChange={(event) => setOtpCode(event.target.value)}
                inputMode="numeric"
                maxLength={6}
                autoFocus
              />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                disabled={isWorking}
              >
                {isWorking ? "Verifying…" : "Enter dashboard"}
                <Icon.ArrowUpRight />
              </button>
            </form>
          )}

          {errorMessage ? (
            <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
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
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <Icon.Sparkle className="h-4 w-4 text-amber-500" />
            Launch demo workspace
          </button>
          <p className="mt-3 text-center text-[0.72rem] text-slate-400">
            Demo mode renders seeded data — no AWS calls are made.
          </p>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string;
  readonly action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
          {eyebrow}
        </p>
        <h2 className="mt-1 font-serif text-[1.8rem] leading-tight text-slate-900">
          {title}
        </h2>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            {description}
          </p>
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
      className={`rounded-2xl bg-white ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-18px_rgba(15,23,42,0.3)] ${padding} ${className}`}
    >
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  sublabel,
  tone = "slate",
  delta,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly sublabel?: string;
  readonly tone?: ChipTone;
  readonly delta?: string;
}) {
  const toneBar: Record<ChipTone, string> = {
    emerald: "from-emerald-400 to-emerald-600",
    amber: "from-amber-400 to-amber-600",
    rose: "from-rose-400 to-rose-600",
    violet: "from-violet-400 to-violet-600",
    sky: "from-sky-400 to-sky-600",
    slate: "from-slate-400 to-slate-600",
    indigo: "from-indigo-400 to-indigo-600",
  };
  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 ring-1 ring-slate-200/80 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-18px_rgba(15,23,42,0.3)]">
      <div
        className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${toneBar[tone]}`}
      />
      <div className="flex items-start justify-between">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
          {label}
        </p>
        {delta ? (
          <Chip tone={tone} className="!text-[0.62rem]">
            {delta}
          </Chip>
        ) : null}
      </div>
      <p className="mt-3 font-serif text-[2.3rem] leading-none text-slate-900">
        {value}
      </p>
      {sublabel ? (
        <p className="mt-2 text-xs text-slate-500">{sublabel}</p>
      ) : null}
    </div>
  );
}

function EmptyRow({ children }: { readonly children: ReactNode }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-6 text-center text-sm text-slate-400">
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
            className="rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-200/70"
          >
            <div className="flex items-center justify-between px-1 pb-2">
              <div className="flex items-center gap-2">
                <Chip tone={col.tone}>{col.title}</Chip>
                <span className="text-xs font-medium text-slate-500">
                  {rows.length}
                </span>
              </div>
              <button
                className="text-slate-400 transition hover:text-slate-700"
                type="button"
                aria-label="Add inquiry"
              >
                <Icon.Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {rows.length === 0 ? (
                <EmptyRow>No items</EmptyRow>
              ) : (
                rows.map((item) => (
                  <div
                    key={String(item.id)}
                    className="group rounded-xl bg-white p-3 ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-md"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">
                        {String(item.inquirerName ?? "Unknown")}
                      </p>
                      <Chip tone={statusChipTone(item.eventType as string)}>
                        {formatStatusLabel(item.eventType as string)}
                      </Chip>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-xs text-slate-500">
                      {String(item.message ?? "No message")}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[0.7rem] text-slate-400">
                      <span>{relative(item.receivedAt as string)}</span>
                      <span className="opacity-0 transition group-hover:opacity-100">
                        <Icon.ArrowUpRight />
                      </span>
                    </div>
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
        sublabel: "last 7 days",
        tone: "violet" as ChipTone,
      },
      {
        label: "Active sessions",
        value: String(activeSessions),
        sublabel: "confirmed and tentative",
        tone: "sky" as ChipTone,
      },
      {
        label: "Open tasks",
        value: String(openTasks),
        sublabel: "across every project",
        tone: "amber" as ChipTone,
      },
      {
        label: "Outstanding A/R",
        value: money(outstandingCents),
        sublabel: "across all invoices",
        tone: "emerald" as ChipTone,
      },
    ];
  }, [dashboard]);

  if (status !== "authenticated" || !session) {
    return <LoginPanel />;
  }

  const isDemo = Boolean((session as LooseRecord).demoMode);

  const topProvider = asRecord(dashboard?.paymentProvider);
  const providerAvailable = Boolean(topProvider.available);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex h-16 items-center gap-2.5 border-b border-slate-200 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Icon.Sparkle className="h-4 w-4 text-amber-300" />
          </div>
          <div>
            <p className="font-serif text-base leading-tight text-slate-900">
              Studio OS
            </p>
            <p className="text-[0.62rem] font-medium uppercase tracking-[0.22em] text-slate-400">
              Kevin Ramos
            </p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const NavIcon = item.icon;
            const isActive = activeNav === item.key;
            return (
              <a
                key={item.key}
                href={`#${item.key}`}
                onClick={() => {
                  setActiveNav(item.key);
                  setSidebarOpen(false);
                }}
                className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? "bg-slate-900 text-white shadow-[0_6px_20px_-8px_rgba(15,23,42,0.4)]" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
              >
                <NavIcon
                  className={`h-4 w-4 ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-700"}`}
                />
                <span>{item.label}</span>
              </a>
            );
          })}
        </nav>

        <div className="m-3 rounded-2xl bg-gradient-to-br from-indigo-50 to-violet-50 p-4 ring-1 ring-indigo-100">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-indigo-700">
            Field-ready PWA
          </p>
          <p className="mt-2 text-xs leading-5 text-slate-600">
            Install on mobile for shot lists and check-in. Offline-capable
            service worker is active.
          </p>
          <Link
            href="/studio"
            className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
          >
            Studio story
            <Icon.ArrowUpRight />
          </Link>
        </div>

        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-2.5 rounded-xl px-2 py-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 text-xs font-semibold text-white">
              {isDemo ? "DM" : "KR"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {isDemo ? "Demo mode" : "Kevin Ramos"}
              </p>
              <p className="truncate text-[0.7rem] text-slate-500">
                {session.phoneNumber}
              </p>
            </div>
            <button
              type="button"
              onClick={logout}
              className="flex-shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-[0.64rem] font-semibold uppercase tracking-[0.08em] text-slate-600 transition hover:border-slate-400 hover:text-slate-900"
            >
              {isDemo ? "Exit" : "Out"}
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Main column */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
          <div className="flex h-16 items-center gap-3 px-4 sm:px-6 lg:px-8">
            <button
              type="button"
              onClick={() => setSidebarOpen((open) => !open)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 lg:hidden"
              aria-label="Toggle navigation"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <div className="relative flex-1 max-w-xl">
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Icon.Search />
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                placeholder="Search clients, sessions, invoices, tasks…"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchResults.length > 0 ? (
                <div className="absolute left-0 right-0 z-30 mt-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
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
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {String(result.title)}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {String(result.subtitle || "No preview")}
                        </p>
                      </div>
                      <Chip tone="slate">
                        {formatStatusLabel(result.entityType as string)}
                      </Chip>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="ml-auto flex items-center gap-2">
              {activeEntry.id ? (
                <button
                  type="button"
                  onClick={() => void stopTimer()}
                  className="inline-flex items-center gap-2 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 ring-1 ring-rose-200 transition hover:bg-rose-100"
                >
                  <Icon.Stop className="h-3 w-3" />
                  <span>{duration(activeMinutes)}</span>
                  <span className="hidden sm:inline">
                    · {String(activeEntry.title)}
                  </span>
                </button>
              ) : (
                <div className="hidden items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-500 sm:inline-flex">
                  <Icon.Play className="h-3 w-3 text-slate-400" />
                  <span>Timer idle</span>
                </div>
              )}

              <button
                type="button"
                className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
                aria-label="Notifications"
              >
                <Icon.Bell />
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500 ring-2 ring-white" />
              </button>

              {isDemo ? (
                <Chip tone="amber" className="hidden sm:inline-flex">
                  <Icon.Sparkle className="h-3 w-3" />
                  Demo mode
                </Chip>
              ) : null}
            </div>
          </div>
        </header>

        <div className="space-y-8 px-4 py-6 sm:px-6 lg:px-8">
          {/* Greeting + KPIs */}
          <section id="overview" className="scroll-mt-24 space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
                  {new Date().toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <h1 className="mt-1 font-serif text-[2.2rem] leading-tight text-slate-900 sm:text-[2.6rem]">
                  Good to see you, Kevin.
                </h1>
                <p className="mt-1 text-sm text-slate-500">
                  {upcomingSessions.length} sessions and{" "}
                  {asArray(dashboard?.bookings).length} studio bookings over the
                  next 14 days.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                >
                  <Icon.Plus className="h-3.5 w-3.5" />
                  New inquiry
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  <Icon.Plus className="h-3.5 w-3.5" />
                  New session
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
                  tone={kpi.tone}
                />
              ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <Card>
                <SectionHeader
                  eyebrow="Next up"
                  title="Upcoming work"
                  description="Sessions and studio bookings in the coming two weeks."
                />
                <div className="mt-5 space-y-2">
                  {upcomingSessions.length === 0 ? (
                    <EmptyRow>No upcoming sessions scheduled.</EmptyRow>
                  ) : (
                    upcomingSessions
                      .slice(0, 5)
                      .map((item: LooseRecord) => {
                        const start = item.scheduledStart ?? item.scheduled_start;
                        return (
                          <div
                            key={String(item.id)}
                            className="group flex items-center gap-4 rounded-xl border border-slate-200/70 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm"
                          >
                            <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-gradient-to-br from-slate-900 to-slate-700 text-white">
                              <span className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-slate-300">
                                {start
                                  ? weekdayFormatter.format(new Date(start))
                                  : "—"}
                              </span>
                              <span className="font-serif text-xl leading-none">
                                {start
                                  ? new Date(start).getDate()
                                  : "·"}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {String(item.title)}
                              </p>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                                <span>
                                  {formatStatusLabel(
                                    item.sessionType as string,
                                  ) || "Session"}
                                </span>
                                <span>·</span>
                                <span className="truncate">
                                  {String(item.locationName ?? "Location TBD")}
                                </span>
                                <span>·</span>
                                <span>{shortDate(start as string)}</span>
                              </div>
                            </div>
                            <Chip tone={statusChipTone(item.status as string)}>
                              {formatStatusLabel(item.status as string) ||
                                "scheduled"}
                            </Chip>
                            <Link
                              href={`/session/${item.id}/shot-list`}
                              className="hidden rounded-lg border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900 group-hover:inline-flex"
                            >
                              <Icon.ArrowUpRight className="h-4 w-4" />
                            </Link>
                          </div>
                        );
                      })
                  )}
                </div>
              </Card>

              <Card>
                <SectionHeader
                  eyebrow="Timer"
                  title={activeEntry.id ? "Running now" : "Start tracking"}
                />
                {activeEntry.id ? (
                  <div className="mt-5 space-y-4">
                    <div className="rounded-2xl bg-gradient-to-br from-rose-50 to-rose-100 p-5 ring-1 ring-rose-200">
                      <div className="flex items-center justify-between">
                        <Chip tone="rose">● Running</Chip>
                        <span className="font-mono text-sm text-rose-700">
                          {duration(activeMinutes)}
                        </span>
                      </div>
                      <p className="mt-3 text-lg font-semibold text-slate-900">
                        {String(activeEntry.title)}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Started {shortDate(activeEntry.startedAt as string)}
                      </p>
                    </div>
                    <textarea
                      className="min-h-[88px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                      value={timeNotes}
                      onChange={(event) => setTimeNotes(event.target.value)}
                      placeholder="Notes before stopping…"
                    />
                    <button
                      type="button"
                      onClick={() => void stopTimer()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                    >
                      <Icon.Stop className="h-3.5 w-3.5" />
                      Stop timer
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 space-y-3">
                    <input
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                      value={timeTitle}
                      onChange={(event) => setTimeTitle(event.target.value)}
                      placeholder="What are you working on?"
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        ["admin", "Admin"],
                        ["standalone", "Standalone"],
                        ["session", "Session"],
                        ["studio_booking", "Studio"],
                      ].map(([value, label]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => setTimeScope(value)}
                          className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${timeScope === value ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => void quickStartTimer()}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-[0_6px_20px_-8px_rgba(99,102,241,0.6)] transition hover:brightness-110"
                    >
                      <Icon.Play className="h-3.5 w-3.5" />
                      Start timer
                    </button>
                  </div>
                )}
                <div className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-5 text-sm">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      Today
                    </p>
                    <p className="mt-1 font-serif text-2xl text-slate-900">
                      {duration(
                        asRecord(asRecord(dashboard?.time).summary)
                          .todayMinutes as number,
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      This week
                    </p>
                    <p className="mt-1 font-serif text-2xl text-slate-900">
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
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {errorMessage}
            </div>
          ) : null}

          {/* Pipeline */}
          <section id="pipeline" className="scroll-mt-24 space-y-4">
            <SectionHeader
              eyebrow="Pipeline"
              title="Inquiries board"
              description="Kanban view of every inquiry, from new → booked. Drag-and-drop coming in the alpha."
              action={
                <>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300"
                  >
                    Filter
                  </button>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    Add
                  </button>
                </>
              }
            />
            <PipelineBoard inquiries={asArray(dashboard?.inquiries)} />

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <SectionHeader
                  eyebrow="Smart files"
                  title="Contracts and questionnaires"
                />
                <div className="mt-4 divide-y divide-slate-100">
                  {asArray(dashboard?.smartFiles).slice(0, 6).length === 0 ? (
                    <EmptyRow>No smart files in flight.</EmptyRow>
                  ) : (
                    asArray(dashboard?.smartFiles)
                      .slice(0, 6)
                      .map((item: LooseRecord) => (
                        <div
                          key={String(item.id)}
                          className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
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

              <Card>
                <SectionHeader
                  eyebrow="Client value"
                  title="Repeat-booking radar"
                />
                <div className="mt-4 space-y-2.5">
                  {asArray(asRecord(dashboard?.ltv).clients)
                    .slice(0, 5)
                    .map((item: LooseRecord, idx) => (
                      <div
                        key={String(item.clientId ?? idx)}
                        className="flex items-center gap-3 rounded-xl bg-slate-50 p-3"
                      >
                        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                          {String(item.name ?? "?")
                            .split(" ")
                            .slice(0, 2)
                            .map((piece) => piece[0])
                            .join("")
                            .toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {String(item.name)}
                          </p>
                          <p className="text-xs text-slate-500">
                            {money(item.lifetimeValueCents as number)} LTV
                          </p>
                        </div>
                        {item.repeatBookingLikely ? (
                          <Chip tone="emerald">Likely repeat</Chip>
                        ) : null}
                      </div>
                    ))}
                </div>
              </Card>
            </div>
          </section>

          {/* Sessions */}
          <section id="sessions" className="scroll-mt-24 space-y-4">
            <SectionHeader
              eyebrow="Photography CRM"
              title="Sessions"
              description="Every booked shoot, with mobile shot lists and per-session timers."
              action={
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                >
                  <Icon.Plus className="h-3 w-3" />
                  Add
                </button>
              }
            />

            <Card padding="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <tr>
                      <th className="px-5 py-3 text-left">Session</th>
                      <th className="px-5 py-3 text-left">When</th>
                      <th className="px-5 py-3 text-left">Client</th>
                      <th className="px-5 py-3 text-left">Status</th>
                      <th className="px-5 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {asArray(dashboard?.sessions).length === 0 ? (
                      <tr>
                        <td colSpan={5}>
                          <EmptyRow>No sessions yet.</EmptyRow>
                        </td>
                      </tr>
                    ) : (
                      asArray(dashboard?.sessions)
                        .slice(0, 8)
                        .map((item: LooseRecord) => (
                          <tr key={String(item.id)} className="transition hover:bg-slate-50/60">
                            <td className="px-5 py-3.5">
                              <p className="font-semibold text-slate-900">
                                {String(item.title)}
                              </p>
                              <p className="text-xs text-slate-500">
                                {formatStatusLabel(
                                  item.sessionType as string,
                                ) || "Session"}{" "}
                                · {String(item.locationName ?? "Location TBD")}
                              </p>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              <span className="whitespace-nowrap">
                                {shortDate(item.scheduledStart as string)}
                              </span>
                              <span className="mt-0.5 block text-xs text-slate-400">
                                {relative(item.scheduledStart as string)}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              {String(item.clientName ?? "—")}
                            </td>
                            <td className="px-5 py-3.5">
                              <Chip tone={statusChipTone(item.status as string)}>
                                {formatStatusLabel(item.status as string) ||
                                  "scheduled"}
                              </Chip>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <Link
                                  href={`/session/${item.id}/shot-list`}
                                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[0.7rem] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
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
                                  className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[0.7rem] font-semibold text-white transition hover:bg-slate-800"
                                >
                                  Start timer
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

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {asArray(asRecord(dashboard?.conversion).byEventType)
                .slice(0, 4)
                .map((item: LooseRecord) => {
                  const rate = Number(item.conversionRate ?? 0);
                  const pct = Math.round(rate * 100);
                  return (
                    <Card key={String(item.eventType)}>
                      <div className="flex items-center justify-between">
                        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                          {formatStatusLabel(item.eventType as string)}
                        </p>
                        <Chip
                          tone={
                            pct >= 60
                              ? "emerald"
                              : pct >= 45
                                ? "sky"
                                : pct >= 30
                                  ? "amber"
                                  : "rose"
                          }
                        >
                          {pct}%
                        </Chip>
                      </div>
                      <p className="mt-3 font-serif text-2xl text-slate-900">
                        {Number(item.bookedCount ?? 0)} / {Number(item.inquiryCount ?? 0)}
                      </p>
                      <p className="text-xs text-slate-500">booked from inquiries</p>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </Card>
                  );
                })}
            </div>
          </section>

          {/* Studio */}
          <section id="studio" className="scroll-mt-24 space-y-4">
            <SectionHeader
              eyebrow="Creator studio"
              title="Bookings, spaces, and access"
              description="Live studio rental ops. Each booking exposes a mobile check-in flow."
            />

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card>
                <div className="space-y-2.5">
                  {asArray(dashboard?.bookings).slice(0, 6).map((item: LooseRecord) => (
                    <div
                      key={String(item.id)}
                      className="flex flex-col gap-3 rounded-xl border border-slate-200/70 bg-white p-3.5 transition hover:border-slate-300 hover:shadow-sm lg:flex-row lg:items-center"
                    >
                      <div className="flex flex-1 items-center gap-3">
                        <div className="flex h-10 w-10 flex-col items-center justify-center rounded-lg bg-slate-900 text-white">
                          <span className="text-[0.55rem] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            {item.bookingStart
                              ? weekdayFormatter.format(
                                  new Date(item.bookingStart as string),
                                )
                              : "—"}
                          </span>
                          <span className="font-serif text-base leading-none">
                            {item.bookingStart
                              ? new Date(item.bookingStart as string).getDate()
                              : "·"}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {String(item.purpose ?? "Studio rental")}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {shortDate(item.bookingStart as string)} · Code{" "}
                            <span className="font-mono text-slate-700">
                              {String(item.accessCode ?? "pending")}
                            </span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Chip tone={statusChipTone(item.status as string)}>
                          {formatStatusLabel(item.status as string)}
                        </Chip>
                        {item.depositPaid ? (
                          <Chip tone="emerald">Deposit paid</Chip>
                        ) : (
                          <Chip tone="amber">Deposit pending</Chip>
                        )}
                        <Link
                          href={`/studio-booking/${item.id}/check-in`}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[0.7rem] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
                        >
                          Check-in
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid gap-4">
                <Card>
                  <SectionHeader eyebrow="Spaces" title="Bays and utilization" />
                  <div className="mt-4 space-y-2">
                    {asArray(dashboard?.spaces).slice(0, 4).map((item: LooseRecord) => (
                      <div
                        key={String(item.id)}
                        className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
                      >
                        <span className="font-medium text-slate-900">
                          {String(item.name)}
                        </span>
                        <span className="text-slate-500">
                          {money(item.hourlyRateCents as number)}/hr
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
                <Card>
                  <SectionHeader eyebrow="Gear" title="Equipment inventory" />
                  <div className="mt-4 space-y-2">
                    {asArray(dashboard?.equipment).slice(0, 5).map((item: LooseRecord) => {
                      const owned = Number(item.quantityOwned ?? 0);
                      const avail = Number(item.quantityAvailable ?? 0);
                      const out = owned - avail;
                      return (
                        <div
                          key={String(item.id)}
                          className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2.5 text-sm"
                        >
                          <span className="font-medium text-slate-900">
                            {String(item.name)}
                          </span>
                          <div className="flex items-center gap-2">
                            {out > 0 ? (
                              <Chip tone="amber">{out} out</Chip>
                            ) : (
                              <Chip tone="emerald">All in</Chip>
                            )}
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
              <SectionHeader
                eyebrow="Studio story"
                title={foldedStudioSource.name}
                description={foldedStudioSource.strapline}
                action={
                  <Link
                    href="/studio"
                    className="inline-flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-slate-300"
                  >
                    View studio page
                    <Icon.ArrowUpRight />
                  </Link>
                }
              />
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {foldedStudioSource.rates.map((rate) => (
                  <div
                    key={rate.label}
                    className="rounded-xl bg-gradient-to-br from-slate-50 to-white p-4 ring-1 ring-slate-200"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        {rate.label}
                      </p>
                      <span className="font-serif text-xl text-slate-900">
                        {rate.price}
                      </span>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      {rate.details}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </section>

          {/* Finance */}
          <section id="finance" className="scroll-mt-24 space-y-4">
            <SectionHeader
              eyebrow="Finance"
              title="Revenue, invoices, and payments"
              description="Stripe checkout runs the card path; manual ledger handles Zelle, cash, check, Venmo, ACH."
            />

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Photo revenue paid"
                value={money(
                  asRecord(asRecord(dashboard?.revenue).totals)
                    .photoPaidCents as number,
                )}
                sublabel={`${currentYearLabel()} YTD`}
                tone="indigo"
              />
              <StatCard
                label="Studio revenue paid"
                value={money(
                  asRecord(asRecord(dashboard?.revenue).totals)
                    .studioPaidCents as number,
                )}
                sublabel={`${currentYearLabel()} YTD`}
                tone="violet"
              />
              <StatCard
                label="Outstanding A/R"
                value={money(
                  asRecord(asRecord(dashboard?.revenue).totals)
                    .outstandingCents as number,
                )}
                sublabel="across all invoices"
                tone="amber"
              />
              <StatCard
                label="Profit"
                value={money(
                  asRecord(asRecord(dashboard?.profit).totals)
                    .profitCents as number,
                )}
                sublabel="revenue minus expenses"
                tone="emerald"
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <Card padding="p-0">
                <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Invoices
                    </p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      Current open and recently closed
                    </p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
                  >
                    <Icon.Plus className="h-3 w-3" />
                    New invoice
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="px-5 py-3 text-left">Client</th>
                        <th className="px-5 py-3 text-left">Type</th>
                        <th className="px-5 py-3 text-right">Total</th>
                        <th className="px-5 py-3 text-right">Balance</th>
                        <th className="px-5 py-3 text-left">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {asArray(dashboard?.invoices)
                        .slice(0, 6)
                        .map((item: LooseRecord) => (
                          <tr key={String(item.id)} className="transition hover:bg-slate-50/60">
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
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                      Payment provider
                    </p>
                    <p className="mt-1 font-serif text-2xl text-slate-900">
                      {String(topProvider.provider ?? "manual").toUpperCase()}
                    </p>
                  </div>
                  <Chip tone={providerAvailable ? "emerald" : "amber"}>
                    {providerAvailable ? "Configured" : "Manual fallback"}
                  </Chip>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Mode: {String(topProvider.mode ?? "test")} ·{" "}
                  {providerAvailable
                    ? "Stripe checkout active"
                    : String(topProvider.reason ?? "Missing Stripe secret")}
                </p>

                <div className="mt-5 space-y-2">
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Recent payments
                  </p>
                  {asArray(dashboard?.payments)
                    .slice(-5)
                    .reverse()
                    .map((item: LooseRecord) => (
                      <div
                        key={String(item.id)}
                        className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {money(item.amountCents as number)}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {formatStatusLabel(item.method as string)} ·{" "}
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
                            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[0.68rem] font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50"
                          >
                            {refundingPaymentId === item.id
                              ? "Refunding…"
                              : "Refund"}
                          </button>
                        ) : null}
                      </div>
                    ))}
                </div>
              </Card>
            </div>

            <Card>
              <SectionHeader eyebrow="Expenses" title="Recent spend" />
              <div className="mt-4 grid gap-2.5 md:grid-cols-2">
                {asArray(dashboard?.expenses)
                  .slice(0, 6)
                  .map((item: LooseRecord) => (
                    <div
                      key={String(item.id)}
                      className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-900">
                          {String(item.description)}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {formatStatusLabel(item.category as string)} ·{" "}
                          {relative(item.spentAt as string)}
                        </p>
                      </div>
                      <span className="font-mono text-slate-900">
                        {money(item.amountCents as number)}
                      </span>
                    </div>
                  ))}
              </div>
            </Card>
          </section>

          {/* Operations */}
          <section id="operations" className="scroll-mt-24 space-y-4">
            <SectionHeader
              eyebrow="Operations"
              title="Tasks"
              description="Spawned from recurring automations, session templates, and manual entry."
            />

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(["open", "in_progress", "completed"] as const).map((state) => {
                const toneByState: Record<typeof state, ChipTone> = {
                  open: "violet",
                  in_progress: "sky",
                  completed: "emerald",
                };
                const rows = asArray(dashboard?.tasks).filter((t) =>
                  state === "completed"
                    ? (t.status as string) === "completed"
                    : state === "in_progress"
                      ? (t.status as string) === "in_progress"
                      : (t.status as string) === "open" || !t.status,
                );
                return (
                  <div
                    key={state}
                    className="rounded-2xl bg-slate-50/70 p-3 ring-1 ring-slate-200/70"
                  >
                    <div className="flex items-center justify-between px-1 pb-2">
                      <Chip tone={toneByState[state]}>
                        {formatStatusLabel(state)}
                      </Chip>
                      <span className="text-xs font-medium text-slate-500">
                        {rows.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {rows.length === 0 ? (
                        <EmptyRow>Nothing here yet.</EmptyRow>
                      ) : (
                        rows.slice(0, 8).map((item: LooseRecord) => (
                          <div
                            key={String(item.id)}
                            className="rounded-xl bg-white p-3 ring-1 ring-slate-200/80"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                {String(item.title)}
                              </p>
                              <Chip tone={priorityTone(item.priority as string)}>
                                {formatStatusLabel(item.priority as string) || "med"}
                              </Chip>
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
          <section id="inbox" className="scroll-mt-24 space-y-4">
            <SectionHeader
              eyebrow="Inbox"
              title="Unified activity feed"
              description="Every material event: emails, signatures, payments, automations, bookings."
            />
            <Card>
              <div className="relative space-y-4 pl-5">
                <div className="absolute inset-y-1 left-1.5 w-px bg-slate-200" />
                {asArray(dashboard?.inbox).length === 0 ? (
                  <EmptyRow>Inbox is quiet.</EmptyRow>
                ) : (
                  asArray(dashboard?.inbox).slice(0, 8).map((item: LooseRecord) => (
                    <div
                      key={String(item.id)}
                      className="relative rounded-xl bg-slate-50/60 p-3.5 ring-1 ring-slate-200/70"
                    >
                      <span className="absolute left-[-1.28rem] top-4 h-2.5 w-2.5 rounded-full bg-white ring-4 ring-slate-200" />
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {String(item.subject ?? item.activityType ?? "Activity")}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {formatStatusLabel(item.activityType as string)}
                          </p>
                        </div>
                        <span className="whitespace-nowrap text-[0.7rem] text-slate-400">
                          {relative(item.occurredAt as string)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </section>

          {loading ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
              Refreshing dashboard…
            </div>
          ) : null}

          <footer className="py-6 text-center text-xs text-slate-400">
            Studio OS · beta · built on AWS · {new Date().getFullYear()}
          </footer>
        </div>
      </div>
    </main>
  );
}

function currentYearLabel() {
  return String(new Date().getUTCFullYear());
}
