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
import { StudioOsLoadingScreen } from "@/components/studio-os-state-screens";
import { readJsonResponse } from "@/lib/http";
import { foldedStudioSource } from "@/lib/studio-source";
import { studioOsRuntimeConfig } from "@/lib/studio-os-config";
import { useStudioOsAuth } from "./studio-os-auth-provider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LooseRecord = Record<string, any>;
type NavKey =
  | "overview"
  | "pipeline"
  | "sessions"
  | "studio"
  | "galleries"
  | "finance"
  | "tasks"
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

const DASHBOARD_WINDOW_MS = 14 * 86400000;

const asArray = (value: unknown): LooseRecord[] =>
  Array.isArray(value) ? (value as LooseRecord[]) : [];
const asRecord = (value: unknown): LooseRecord =>
  (value && typeof value === "object" ? value : {}) as LooseRecord;

const humanizeLabel = (value?: string | null) =>
  String(value ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());

const searchResultHref = (result: LooseRecord) => {
  switch (result.entityType) {
    case "session":
      return `/session/${result.entityId}/shot-list`;
    case "studio_booking":
      return `/studio-booking/${result.entityId}/check-in`;
    case "invoice":
      return "#finance";
    case "task":
      return "#tasks";
    case "activity":
      return "#inbox";
    case "inquiry":
      return "#pipeline";
    case "gallery":
      return "#galleries";
    case "smart_file":
    case "client":
    default:
      return "#pipeline";
  }
};

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
  Gallery: ({ className = "h-4 w-4" }: IconProps) => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="3" width="18" height="14" rx="2" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m4 16 5-5 4 4 3-3 4 4" />
      <path d="M5 21h14" />
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
  { key: "galleries", label: "Galleries", icon: Icon.Gallery },
  { key: "finance", label: "Finance", icon: Icon.Wallet },
  { key: "tasks", label: "Tasks", icon: Icon.Tasks },
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
      const nextPath = new URLSearchParams(window.location.search).get("next");
      window.localStorage.setItem("studio-os-admin-demo-mode-v1", "1");
      if (nextPath && nextPath.startsWith("/") && !nextPath.startsWith("//")) {
        window.location.replace(nextPath);
        return;
      }
      window.location.replace("/admin?demo=1");
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

function EmptyState({
  headline,
  hint,
  action,
  variant = "block",
}: {
  readonly headline: string;
  readonly hint?: string;
  readonly action?: ReactNode;
  readonly variant?: "block" | "row" | "column";
}) {
  if (variant === "column") {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-white/60 px-3 py-5 text-center">
        <p className="text-xs font-medium text-slate-600">{headline}</p>
        {hint ? (
          <p className="mt-1 text-[0.7rem] text-slate-400">{hint}</p>
        ) : null}
        {action ? (
          <div className="mt-2.5 flex justify-center">{action}</div>
        ) : null}
      </div>
    );
  }

  if (variant === "row") {
    return (
      <div className="px-5 py-6">
        <p className="text-sm font-medium text-slate-700">{headline}</p>
        {hint ? (
          <p className="mt-1 text-xs text-slate-500">{hint}</p>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 px-5 py-8 text-center">
      <p className="text-sm font-medium text-slate-700">{headline}</p>
      {hint ? (
        <p className="mt-1 text-xs text-slate-500">{hint}</p>
      ) : null}
      {action ? (
        <div className="mt-4 flex justify-center">{action}</div>
      ) : null}
    </div>
  );
}

function Modal({
  open,
  onClose,
  title,
  description,
  children,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 w-full max-w-lg rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-3.5">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description ? (
              <p className="mt-0.5 text-xs text-slate-500">{description}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-4 w-4"
            >
              <path d="M6 6l12 12M6 18 18 6" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

const formInputClass =
  "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10";
const formSelectClass = `${formInputClass} appearance-none`;
const formTextareaClass = `${formInputClass} min-h-[80px] resize-none`;

function Field({
  label,
  hint,
  required = false,
  children,
}: {
  readonly label: string;
  readonly hint?: string;
  readonly required?: boolean;
  readonly children: ReactNode;
}) {
  return (
    <label className="block text-sm">
      <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
        {label}
        {required ? (
          <span className="text-rose-500" aria-hidden>
            *
          </span>
        ) : null}
      </span>
      <div className="mt-1">{children}</div>
      {hint ? (
        <p className="mt-1 text-[0.7rem] text-slate-400">{hint}</p>
      ) : null}
    </label>
  );
}

function FormActions({
  onCancel,
  submitting,
  submitLabel,
  submittingLabel = "Saving…",
}: {
  readonly onCancel: () => void;
  readonly submitting: boolean;
  readonly submitLabel: string;
  readonly submittingLabel?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2 pt-1">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? submittingLabel : submitLabel}
      </button>
    </div>
  );
}

const inquiryEventTypeOptions: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
}> = [
  { value: "wedding", label: "Wedding" },
  { value: "portrait", label: "Portrait" },
  { value: "branding", label: "Branding" },
  { value: "family", label: "Family" },
  { value: "studio_rental", label: "Studio rental" },
  { value: "podcast", label: "Podcast" },
  { value: "commercial", label: "Commercial" },
  { value: "other", label: "Other" },
];

const inquiryStageOptions: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
}> = [
  { value: "new", label: "New" },
  { value: "qualifying", label: "Qualifying" },
  { value: "proposal_sent", label: "Proposal sent" },
  { value: "won", label: "Booked" },
];

const sessionStatusOptions: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
}> = [
  { value: "tentative", label: "Tentative" },
  { value: "confirmed", label: "Confirmed" },
  { value: "completed", label: "Completed" },
];

const invoiceSourceTypeOptions: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
}> = [
  { value: "wedding", label: "Wedding" },
  { value: "portrait", label: "Portrait" },
  { value: "branding", label: "Branding" },
  { value: "family", label: "Family" },
  { value: "commercial", label: "Commercial" },
  { value: "studio_buyout", label: "Studio buyout" },
  { value: "other", label: "Other" },
];

const invoiceStatusOptions: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
}> = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent" },
  { value: "partial", label: "Partial" },
  { value: "paid", label: "Paid" },
  { value: "overdue", label: "Overdue" },
];

const taskPriorityOptions: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
}> = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

const taskStatusOptions: ReadonlyArray<{
  readonly value: string;
  readonly label: string;
}> = [
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

type CreateInquiryPayload = {
  readonly inquirerName: string;
  readonly contactEmail: string;
  readonly contactPhone: string;
  readonly eventType: string;
  readonly status: string;
  readonly message: string;
};

function InquiryFormModal({
  open,
  onClose,
  onSubmit,
  defaultStatus,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (payload: CreateInquiryPayload) => Promise<void>;
  readonly defaultStatus: string;
}) {
  const [inquirerName, setInquirerName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [eventType, setEventType] = useState("wedding");
  const [status, setStatus] = useState(defaultStatus);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
      setError(null);
    }
  }, [open, defaultStatus]);

  const reset = () => {
    setInquirerName("");
    setContactEmail("");
    setContactPhone("");
    setEventType("wedding");
    setStatus(defaultStatus);
    setMessage("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inquirerName.trim()) {
      setError("Name is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        inquirerName: inquirerName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        eventType,
        status,
        message: message.trim(),
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create inquiry.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New inquiry"
      description="Capture a lead from email, phone, or in-person."
    >
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Name" required>
          <input
            className={formInputClass}
            value={inquirerName}
            onChange={(event) => setInquirerName(event.target.value)}
            autoFocus
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email">
            <input
              className={formInputClass}
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
            />
          </Field>
          <Field label="Phone">
            <input
              className={formInputClass}
              type="tel"
              value={contactPhone}
              onChange={(event) => setContactPhone(event.target.value)}
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Event type">
            <select
              className={formSelectClass}
              value={eventType}
              onChange={(event) => setEventType(event.target.value)}
            >
              {inquiryEventTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Stage">
            <select
              className={formSelectClass}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {inquiryStageOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Message">
          <textarea
            className={formTextareaClass}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="What did they ask for?"
          />
        </Field>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}
        <FormActions
          onCancel={onClose}
          submitting={submitting}
          submitLabel="Save inquiry"
        />
      </form>
    </Modal>
  );
}

type CreateSessionPayload = {
  readonly title: string;
  readonly sessionType: string;
  readonly locationName: string;
  readonly clientName: string;
  readonly status: string;
  readonly scheduledStart: string;
  readonly scheduledEnd: string;
};

const combineDateTime = (dateValue: string, timeValue: string): string | null => {
  if (!dateValue) return null;
  const composed = `${dateValue}T${timeValue || "09:00"}`;
  const parsed = new Date(composed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

function SessionFormModal({
  open,
  onClose,
  onSubmit,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (payload: CreateSessionPayload) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [sessionType, setSessionType] = useState("portrait");
  const [locationName, setLocationName] = useState("");
  const [clientName, setClientName] = useState("");
  const [status, setStatus] = useState("confirmed");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("12:00");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const reset = () => {
    setTitle("");
    setSessionType("portrait");
    setLocationName("");
    setClientName("");
    setStatus("confirmed");
    setDate("");
    setStartTime("10:00");
    setEndTime("12:00");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Session title is required.");
      return;
    }
    const scheduledStart = combineDateTime(date, startTime);
    const scheduledEnd = combineDateTime(date, endTime);
    if (!scheduledStart || !scheduledEnd) {
      setError("Pick a date and start/end time.");
      return;
    }
    if (new Date(scheduledEnd).getTime() <= new Date(scheduledStart).getTime()) {
      setError("End time has to be after start time.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        sessionType,
        locationName: locationName.trim(),
        clientName: clientName.trim(),
        status,
        scheduledStart,
        scheduledEnd,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create session.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New session"
      description="Schedule a shoot, studio block, or planning call."
    >
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Title" required>
          <input
            className={formInputClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Ortiz wedding — ceremony + reception"
            autoFocus
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <select
              className={formSelectClass}
              value={sessionType}
              onChange={(event) => setSessionType(event.target.value)}
            >
              {inquiryEventTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className={formSelectClass}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {sessionStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Client">
            <input
              className={formInputClass}
              value={clientName}
              onChange={(event) => setClientName(event.target.value)}
              placeholder="Who is this for?"
            />
          </Field>
          <Field label="Location">
            <input
              className={formInputClass}
              value={locationName}
              onChange={(event) => setLocationName(event.target.value)}
              placeholder="Venue or studio"
            />
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Date" required>
            <input
              className={formInputClass}
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field label="Start" required>
            <input
              className={formInputClass}
              type="time"
              value={startTime}
              onChange={(event) => setStartTime(event.target.value)}
            />
          </Field>
          <Field label="End" required>
            <input
              className={formInputClass}
              type="time"
              value={endTime}
              onChange={(event) => setEndTime(event.target.value)}
            />
          </Field>
        </div>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}
        <FormActions
          onCancel={onClose}
          submitting={submitting}
          submitLabel="Save session"
        />
      </form>
    </Modal>
  );
}

type CreateInvoicePayload = {
  readonly clientName: string;
  readonly sourceType: string;
  readonly status: string;
  readonly totalCents: number;
  readonly dueAt: string | null;
};

function InvoiceFormModal({
  open,
  onClose,
  onSubmit,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (payload: CreateInvoicePayload) => Promise<void>;
}) {
  const [clientName, setClientName] = useState("");
  const [sourceType, setSourceType] = useState("wedding");
  const [status, setStatus] = useState("draft");
  const [totalDollars, setTotalDollars] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  const reset = () => {
    setClientName("");
    setSourceType("wedding");
    setStatus("draft");
    setTotalDollars("");
    setDueAt("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!clientName.trim()) {
      setError("Client name is required.");
      return;
    }
    const dollars = Number(totalDollars);
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Enter a total greater than zero.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        clientName: clientName.trim(),
        sourceType,
        status,
        totalCents: Math.round(dollars * 100),
        dueAt: dueAt ? new Date(`${dueAt}T12:00`).toISOString() : null,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invoice.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New invoice"
      description="Bill a client for a session, package, or studio rental."
    >
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Client" required>
          <input
            className={formInputClass}
            value={clientName}
            onChange={(event) => setClientName(event.target.value)}
            placeholder="Who is being billed?"
            autoFocus
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Type">
            <select
              className={formSelectClass}
              value={sourceType}
              onChange={(event) => setSourceType(event.target.value)}
            >
              {invoiceSourceTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className={formSelectClass}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {invoiceStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Total" required hint="In US dollars.">
            <input
              className={formInputClass}
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={totalDollars}
              onChange={(event) => setTotalDollars(event.target.value)}
              placeholder="0.00"
            />
          </Field>
          <Field label="Due">
            <input
              className={formInputClass}
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </Field>
        </div>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}
        <FormActions
          onCancel={onClose}
          submitting={submitting}
          submitLabel="Save invoice"
        />
      </form>
    </Modal>
  );
}

type CreateTaskPayload = {
  readonly title: string;
  readonly priority: string;
  readonly status: string;
  readonly dueAt: string | null;
};

function TaskFormModal({
  open,
  onClose,
  onSubmit,
  defaultStatus,
}: {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSubmit: (payload: CreateTaskPayload) => Promise<void>;
  readonly defaultStatus: string;
}) {
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("medium");
  const [status, setStatus] = useState(defaultStatus);
  const [dueAt, setDueAt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setStatus(defaultStatus);
      setError(null);
    }
  }, [open, defaultStatus]);

  const reset = () => {
    setTitle("");
    setPriority("medium");
    setStatus(defaultStatus);
    setDueAt("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      setError("Task title is required.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        title: title.trim(),
        priority,
        status,
        dueAt: dueAt ? new Date(`${dueAt}T17:00`).toISOString() : null,
      });
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create task.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New task"
      description="Add to-dos for the studio or for a specific client."
    >
      <form className="space-y-3" onSubmit={submit}>
        <Field label="Title" required>
          <input
            className={formInputClass}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Send Ortiz wedding timeline draft"
            autoFocus
          />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Priority">
            <select
              className={formSelectClass}
              value={priority}
              onChange={(event) => setPriority(event.target.value)}
            >
              {taskPriorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className={formSelectClass}
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              {taskStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Due">
            <input
              className={formInputClass}
              type="date"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </Field>
        </div>
        {error ? (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
            {error}
          </p>
        ) : null}
        <FormActions
          onCancel={onClose}
          submitting={submitting}
          submitLabel="Save task"
        />
      </form>
    </Modal>
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

function PipelineBoard({
  inquiries,
  onAddInquiry,
}: {
  readonly inquiries: LooseRecord[];
  readonly onAddInquiry: (status: string) => void;
}) {
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
                onClick={() => onAddInquiry(col.key)}
                aria-label={`Add to ${col.title}`}
                className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
              >
                <Icon.Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-2">
              {rows.length === 0 ? (
                <EmptyState
                  variant="column"
                  headline={`No ${col.title.toLowerCase()} leads`}
                  hint="Tap + to capture one."
                />
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
  const isDemo = Boolean((session as LooseRecord | null)?.demoMode);
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
  const [timerPending, setTimerPending] = useState(false);
  const [nowTick, setNowTick] = useState(Date.now());
  const [activeNav, setActiveNav] = useState<NavKey>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [inquiryModalOpen, setInquiryModalOpen] = useState(false);
  const [inquiryDefaultStage, setInquiryDefaultStage] = useState("new");
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [taskModalDefaultStatus, setTaskModalDefaultStatus] = useState<
    string | null
  >(null);
  const deferredSearch = useDeferredValue(searchInput);

  const fetchJson = useCallback(
    async <T,>(path: string, fallbackMessage: string) =>
      readJsonResponse<T>(await authorizedFetch(path), fallbackMessage),
    [authorizedFetch],
  );

  const loadDashboard = useCallback(async () => {
    if (status !== "authenticated") return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const year = new Date().getUTCFullYear();
      const range = `from=${encodeURIComponent(new Date().toISOString())}&to=${encodeURIComponent(new Date(Date.now() + DASHBOARD_WINDOW_MS).toISOString())}`;
      const requests = [
        {
          label: "summary",
          fallback: {},
          load: fetchJson<Record<string, unknown>>(
            "/dashboard",
            "Unable to load the overview summary.",
          ),
        },
        {
          label: "pipeline",
          fallback: { inquiries: [] },
          load: fetchJson<Record<string, unknown>>(
            "/inquiries?limit=12",
            "Unable to load inquiries.",
          ),
        },
        {
          label: "sessions",
          fallback: { sessions: [] },
          load: fetchJson<Record<string, unknown>>(
            "/sessions?limit=12",
            "Unable to load sessions.",
          ),
        },
        {
          label: "calendar",
          fallback: { entries: [] },
          load: fetchJson<Record<string, unknown>>(
            `/calendar?${range}`,
            "Unable to load the calendar.",
          ),
        },
        {
          label: "smart files",
          fallback: { smartFiles: [] },
          load: fetchJson<Record<string, unknown>>(
            "/smart-files",
            "Unable to load smart files.",
          ),
        },
        {
          label: "galleries",
          fallback: { galleries: [] },
          load: fetchJson<Record<string, unknown>>(
            "/galleries",
            "Unable to load galleries.",
          ),
        },
        {
          label: "bookings",
          fallback: { bookings: [] },
          load: fetchJson<Record<string, unknown>>(
            "/studio/bookings",
            "Unable to load studio bookings.",
          ),
        },
        {
          label: "spaces",
          fallback: { spaces: [] },
          load: fetchJson<Record<string, unknown>>(
            "/studio/spaces",
            "Unable to load studio spaces.",
          ),
        },
        {
          label: "equipment",
          fallback: { equipment: [] },
          load: fetchJson<Record<string, unknown>>(
            "/studio/equipment",
            "Unable to load studio equipment.",
          ),
        },
        {
          label: "invoices",
          fallback: { invoices: [] },
          load: fetchJson<Record<string, unknown>>(
            "/invoices",
            "Unable to load invoices.",
          ),
        },
        {
          label: "payments",
          fallback: { payments: [] },
          load: fetchJson<Record<string, unknown>>(
            "/payments?limit=12",
            "Unable to load payments.",
          ),
        },
        {
          label: "payment provider",
          fallback: { configuration: {} },
          load: fetchJson<Record<string, unknown>>(
            "/payments/provider",
            "Unable to load payment provider details.",
          ),
        },
        {
          label: "expenses",
          fallback: { expenses: [] },
          load: fetchJson<Record<string, unknown>>(
            "/expenses",
            "Unable to load expenses.",
          ),
        },
        {
          label: "tasks",
          fallback: { tasks: [] },
          load: fetchJson<Record<string, unknown>>(
            "/tasks?limit=12",
            "Unable to load tasks.",
          ),
        },
        {
          label: "activity",
          fallback: { activities: [] },
          load: fetchJson<Record<string, unknown>>(
            "/inbox",
            "Unable to load activity.",
          ),
        },
        {
          label: "revenue",
          fallback: { totals: {} },
          load: fetchJson<Record<string, unknown>>(
            `/reports/revenue?year=${year}`,
            "Unable to load the revenue report.",
          ),
        },
        {
          label: "profit",
          fallback: { totals: {} },
          load: fetchJson<Record<string, unknown>>(
            `/reports/profit?year=${year}`,
            "Unable to load the profit report.",
          ),
        },
        {
          label: "conversion",
          fallback: { byEventType: [] },
          load: fetchJson<Record<string, unknown>>(
            "/reports/conversion",
            "Unable to load conversion metrics.",
          ),
        },
        {
          label: "ltv",
          fallback: { clients: [] },
          load: fetchJson<Record<string, unknown>>(
            "/reports/ltv",
            "Unable to load lifetime value metrics.",
          ),
        },
        {
          label: "time tracking",
          fallback: { summary: {}, entries: [] },
          load: fetchJson<Record<string, unknown>>(
            "/time-entries?limit=12",
            "Unable to load time tracking.",
          ),
        },
      ] as const;
      const settled = await Promise.allSettled(
        requests.map((request) => request.load),
      );
      const failures = settled.flatMap((result, index) =>
        result.status === "rejected" ? [requests[index].label] : [],
      );
      const resolved = settled.map((result, index) =>
        result.status === "fulfilled" ? result.value : requests[index].fallback,
      );

      setDashboard({
        summary: resolved[0],
        inquiries: asArray(asRecord(resolved[1]).inquiries),
        sessions: asArray(asRecord(resolved[2]).sessions),
        calendar: asArray(asRecord(resolved[3]).entries),
        smartFiles: asArray(asRecord(resolved[4]).smartFiles),
        galleries: asArray(asRecord(resolved[5]).galleries),
        bookings: asArray(asRecord(resolved[6]).bookings),
        spaces: asArray(asRecord(resolved[7]).spaces),
        equipment: asArray(asRecord(resolved[8]).equipment),
        invoices: asArray(asRecord(resolved[9]).invoices),
        payments: asArray(asRecord(resolved[10]).payments),
        paymentProvider: asRecord(resolved[11]).configuration,
        expenses: asArray(asRecord(resolved[12]).expenses),
        tasks: asArray(asRecord(resolved[13]).tasks),
        inbox: asArray(asRecord(resolved[14]).activities),
        revenue: asRecord(resolved[15]),
        profit: asRecord(resolved[16]),
        conversion: asRecord(resolved[17]),
        ltv: asRecord(resolved[18]),
        time: asRecord(resolved[19]),
      });

      if (failures.length > 0) {
        setErrorMessage(
          failures.length === requests.length
            ? "Unable to load the dashboard right now."
            : `Some sections are temporarily unavailable: ${failures.slice(0, 4).join(", ")}${failures.length > 4 ? ", and more" : ""}.`,
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load dashboard.",
      );
    } finally {
      setLoading(false);
    }
  }, [fetchJson, status]);

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
    fetchJson<Record<string, unknown>>(
      `/search?q=${encodeURIComponent(deferredSearch)}&limit=8`,
      "Unable to search right now.",
    )
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
  }, [deferredSearch, fetchJson, status]);

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
    : asArray(asRecord(dashboard?.summary).upcomingSessions).length
      ? asArray(asRecord(dashboard?.summary).upcomingSessions)
      : asArray(dashboard?.sessions).filter((session) => {
          const scheduledAt = String(
            (session.scheduledStart ??
              session.scheduled_start ??
              session.scheduledAt ??
              "") as string,
          );
          const scheduledTime = new Date(scheduledAt).getTime();
          return (
            Number.isFinite(scheduledTime) &&
            scheduledTime >= Date.now() &&
            scheduledTime <= Date.now() + DASHBOARD_WINDOW_MS
          );
        });

  const quickStartTimer = async (
    scope = timeScope,
    scopeId?: string,
    title = timeTitle,
  ) => {
    if (!title.trim()) {
      setErrorMessage("A timer title is required.");
      return;
    }

    setTimerPending(true);
    setErrorMessage(null);
    try {
      await readJsonResponse<Record<string, unknown>>(
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
        }),
        "Unable to start the timer.",
      );

      setTimeTitle("");
      setTimeNotes("");
      setTimeScope("admin");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to start timer.",
      );
    } finally {
      setTimerPending(false);
    }
  };

  const stopTimer = async () => {
    if (!activeEntry.id) return;
    setTimerPending(true);
    setErrorMessage(null);
    try {
      await readJsonResponse<Record<string, unknown>>(
        await authorizedFetch(`/time-entries/${activeEntry.id}/stop`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": requestKey(),
          },
          body: JSON.stringify({
            notes: timeNotes.trim() || activeEntry.notes || null,
          }),
        }),
        "Unable to stop the timer.",
      );

      setTimeNotes("");
      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to stop timer.",
      );
    } finally {
      setTimerPending(false);
    }
  };

  const refundStripePayment = async (paymentId: string) => {
    setRefundingPaymentId(paymentId);
    setErrorMessage(null);
    try {
      await readJsonResponse<Record<string, unknown>>(
        await authorizedFetch(`/payments/${paymentId}/refund`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": requestKey(),
          },
          body: JSON.stringify({}),
        }),
        "Unable to refund this payment.",
      );
      await loadDashboard();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to refund payment.",
      );
    } finally {
      setRefundingPaymentId(null);
    }
  };

  const openInquiryModal = useCallback((stage: string = "new") => {
    setInquiryDefaultStage(stage);
    setInquiryModalOpen(true);
  }, []);

  const openTaskModal = useCallback((status: string = "open") => {
    setTaskModalDefaultStatus(status);
  }, []);

  const createInquiry = useCallback(
    async (payload: CreateInquiryPayload) => {
      const newInquiry = {
        id: `inq_${Date.now()}`,
        inquirerName: payload.inquirerName,
        contactEmail: payload.contactEmail || null,
        contactPhone: payload.contactPhone || null,
        eventType: payload.eventType,
        status: payload.status,
        message: payload.message,
        receivedAt: new Date().toISOString(),
      };

      if (isDemo) {
        setDashboard((current) => {
          const inquiries = [newInquiry, ...asArray(current?.inquiries)];
          const summary = {
            ...asRecord(current?.summary),
            new_inquiry_count: inquiries.filter(
              (item) => (item.status as string) === "new",
            ).length,
          };
          return { ...(current ?? {}), inquiries, summary };
        });
        return;
      }

      await readJsonResponse<Record<string, unknown>>(
        await authorizedFetch("/inquiries", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": requestKey(),
          },
          body: JSON.stringify(newInquiry),
        }),
        "Could not create inquiry.",
      );
      await loadDashboard();
    },
    [authorizedFetch, isDemo, loadDashboard],
  );

  const createSession = useCallback(
    async (payload: CreateSessionPayload) => {
      const newSession = {
        id: `sess_${Date.now()}`,
        title: payload.title,
        sessionType: payload.sessionType,
        locationName: payload.locationName || null,
        clientName: payload.clientName || null,
        scheduledStart: payload.scheduledStart,
        scheduledEnd: payload.scheduledEnd,
        status: payload.status,
      };

      if (isDemo) {
        setDashboard((current) => {
          const sessions = [newSession, ...asArray(current?.sessions)];
          const summaryRecord = asRecord(current?.summary);
          const upcomingSrc = asArray(summaryRecord.upcoming_sessions);
          const startMs = new Date(payload.scheduledStart).getTime();
          const inWindow =
            Number.isFinite(startMs) &&
            startMs >= Date.now() &&
            startMs <= Date.now() + DASHBOARD_WINDOW_MS;
          const upcoming = inWindow
            ? ([...upcomingSrc, newSession] as LooseRecord[]).sort((a, b) => {
                const left = new Date(
                  String(a.scheduledStart ?? a.scheduled_start ?? ""),
                ).getTime();
                const right = new Date(
                  String(b.scheduledStart ?? b.scheduled_start ?? ""),
                ).getTime();
                return left - right;
              })
            : upcomingSrc;
          const summary = {
            ...summaryRecord,
            upcoming_sessions: upcoming,
            active_session_count: upcoming.length,
          };
          return { ...(current ?? {}), sessions, summary };
        });
        return;
      }

      await readJsonResponse<Record<string, unknown>>(
        await authorizedFetch("/sessions", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": requestKey(),
          },
          body: JSON.stringify(newSession),
        }),
        "Could not create session.",
      );
      await loadDashboard();
    },
    [authorizedFetch, isDemo, loadDashboard],
  );

  const createInvoice = useCallback(
    async (payload: CreateInvoicePayload) => {
      const newInvoice = {
        id: `inv_${Date.now()}`,
        clientName: payload.clientName,
        sourceType: payload.sourceType,
        status: payload.status,
        totalCents: payload.totalCents,
        balanceCents:
          payload.status === "paid" ? 0 : payload.totalCents,
        issuedAt: new Date().toISOString(),
        dueAt: payload.dueAt,
      };

      if (isDemo) {
        setDashboard((current) => {
          const invoices = [newInvoice, ...asArray(current?.invoices)];
          const outstandingCents = invoices.reduce(
            (sum, inv) => sum + Number((inv as LooseRecord).balanceCents ?? 0),
            0,
          );
          const revenueRecord = asRecord(current?.revenue);
          const totalsRecord = asRecord(revenueRecord.totals);
          const revenue = {
            ...revenueRecord,
            totals: { ...totalsRecord, outstandingCents },
          };
          const summary = {
            ...asRecord(current?.summary),
            outstanding_invoice_cents: outstandingCents,
          };
          return { ...(current ?? {}), invoices, revenue, summary };
        });
        return;
      }

      await readJsonResponse<Record<string, unknown>>(
        await authorizedFetch("/invoices", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": requestKey(),
          },
          body: JSON.stringify(newInvoice),
        }),
        "Could not create invoice.",
      );
      await loadDashboard();
    },
    [authorizedFetch, isDemo, loadDashboard],
  );

  const createTask = useCallback(
    async (payload: CreateTaskPayload) => {
      const newTask = {
        id: `tk_${Date.now()}`,
        title: payload.title,
        priority: payload.priority,
        status: payload.status,
        dueAt: payload.dueAt,
      };

      if (isDemo) {
        setDashboard((current) => {
          const tasks = [newTask, ...asArray(current?.tasks)];
          const summary = {
            ...asRecord(current?.summary),
            open_task_count: tasks.filter(
              (task) => (task.status as string) !== "completed",
            ).length,
          };
          return { ...(current ?? {}), tasks, summary };
        });
        return;
      }

      await readJsonResponse<Record<string, unknown>>(
        await authorizedFetch("/tasks", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "Idempotency-Key": requestKey(),
          },
          body: JSON.stringify(newTask),
        }),
        "Could not create task.",
      );
      await loadDashboard();
    },
    [authorizedFetch, isDemo, loadDashboard],
  );

  const kpis = useMemo(() => {
    const newInquiries = Number(
      asRecord(dashboard?.summary).new_inquiry_count ??
        asArray(dashboard?.inquiries).filter(
          (i) => (i.status as string) === "new",
        ).length ??
        0,
    );
    const activeSessions = upcomingSessions.length;
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
  }, [dashboard, upcomingSessions.length]);

  if (status === "booting") {
    return (
      <StudioOsLoadingScreen
        title="Loading Studio OS"
        description="Restoring your workspace."
      />
    );
  }

  if (status !== "authenticated" || !session) {
    return <LoginPanel />;
  }

  const topProvider = asRecord(dashboard?.paymentProvider);
  const providerAvailable = Boolean(topProvider.available);

  const overdueInvoices = asArray(dashboard?.invoices).filter(
    (inv) => (inv.status as string) === "overdue",
  ).length;

  const headerActions = (
    <>
      {activeEntry.id ? (
        <button
          type="button"
          onClick={() => void stopTimer()}
          disabled={timerPending}
          className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
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

      <div
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500"
        role="status"
        aria-label={
          overdueInvoices > 0
            ? `${overdueInvoices} overdue invoice alerts`
            : "No overdue invoice alerts"
        }
        title={
          overdueInvoices > 0
            ? `${overdueInvoices} overdue invoice alerts`
            : "No overdue invoice alerts"
        }
      >
        <Icon.Bell />
        {overdueInvoices > 0 ? (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
        ) : null}
      </div>

      {isDemo ? (
        <span className="hidden items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-[0.68rem] font-medium text-amber-800 sm:inline-flex">
          Demo data
        </span>
      ) : null}
    </>
  );

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
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:h-14 sm:flex-nowrap sm:py-0 sm:px-6 lg:px-8">
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
            <div className="ml-auto flex items-center gap-1.5 sm:hidden">
              {headerActions}
            </div>

            <div className="relative order-3 w-full sm:order-none sm:min-w-0 sm:flex-1 sm:max-w-md">
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
                      href={searchResultHref(result)}
                      onClick={() => {
                        setSearchInput("");
                        setSearchResults([]);
                      }}
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
                        {humanizeLabel(result.entityType as string)}
                      </span>
                    </a>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="hidden sm:ml-auto sm:flex sm:items-center sm:gap-1.5">
              {headerActions}
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
                  onClick={() => openInquiryModal("new")}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Icon.Plus className="h-3 w-3" />
                  Inquiry
                </button>
                <button
                  type="button"
                  onClick={() => setSessionModalOpen(true)}
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
                    <EmptyState
                      variant="row"
                      headline="No sessions in the next two weeks"
                      hint="Add one with the Session button above."
                    />
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
                      disabled={timerPending}
                      className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {timerPending ? "Stopping…" : "Stop timer"}
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
                      disabled={timerPending}
                      className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {timerPending ? "Starting…" : "Start"}
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
                <button
                  type="button"
                  onClick={() => openInquiryModal("new")}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-slate-800"
                >
                  <Icon.Plus className="h-3 w-3" />
                  Inquiry
                </button>
              }
            />
            <PipelineBoard
              inquiries={asArray(dashboard?.inquiries)}
              onAddInquiry={openInquiryModal}
            />

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <Card padding="p-0">
                <div className="px-5 py-3.5">
                  <SectionTitle title="Smart files" />
                </div>
                <div className="divide-y divide-slate-100 border-t border-slate-100">
                  {asArray(dashboard?.smartFiles).slice(0, 6).length === 0 ? (
                    <EmptyState
                      variant="row"
                      headline="No smart files in flight"
                      hint="Contracts and questionnaires you send will appear here."
                    />
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
                  onClick={() => setSessionModalOpen(true)}
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
                          <EmptyState
                            variant="row"
                            headline="No sessions yet"
                            hint="Use the Session button above to schedule the first one."
                          />
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
                                  disabled={timerPending}
                                  className="rounded-md bg-slate-900 px-2 py-1 text-[0.72rem] font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
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

          {/* Galleries */}
          <section id="galleries" className="scroll-mt-20 space-y-4">
            <SectionTitle
              title="Galleries"
              meta="Delivered, ready to send, and processing."
            />
            {asArray(dashboard?.galleries).length === 0 ? (
              <EmptyState
                headline="No galleries yet"
                hint="Galleries appear here once shots upload and finish processing."
              />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {asArray(dashboard?.galleries).map((item: LooseRecord) => {
                  const status = String(item.status ?? "processing");
                  const photos = Number(item.photoCount ?? 0);
                  const delivered = item.deliveredAt as string | null;
                  return (
                    <div
                      key={String(item.id)}
                      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-900">
                          {String(item.name)}
                        </p>
                        <Chip tone={statusChipTone(status)}>
                          {formatStatusLabel(status)}
                        </Chip>
                      </div>
                      <div className="mt-3 flex items-end justify-between">
                        <p className="font-mono text-2xl font-semibold leading-none text-slate-900">
                          {photos}
                          <span className="ml-1 text-xs font-normal text-slate-500">
                            photos
                          </span>
                        </p>
                        <p className="text-xs text-slate-500">
                          {delivered
                            ? `Delivered ${relative(delivered)}`
                            : "Awaiting delivery"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
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
                    onClick={() => setInvoiceModalOpen(true)}
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
                    <p className="mt-0.5 text-xs text-slate-500 capitalize">
                      {String(topProvider.mode ?? "test")} mode
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

          {/* Tasks */}
          <section id="tasks" className="scroll-mt-20 space-y-4">
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
                        onClick={() => openTaskModal(state)}
                        aria-label={`Add ${formatStatusLabel(state)} task`}
                        className="rounded p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                      >
                        <Icon.Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="space-y-2">
                      {rows.length === 0 ? (
                        <EmptyState
                          variant="column"
                          headline={
                            state === "completed"
                              ? "Nothing completed yet"
                              : state === "in_progress"
                                ? "Nothing in progress"
                                : "All clear"
                          }
                          hint={
                            state === "completed"
                              ? "Finished tasks land here."
                              : "Tap + to add one."
                          }
                        />
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
                  <li>
                    <EmptyState
                      variant="row"
                      headline="Inbox is clear"
                      hint="Replies, signed contracts, and payments show up here."
                    />
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

      <InquiryFormModal
        open={inquiryModalOpen}
        defaultStatus={inquiryDefaultStage}
        onClose={() => setInquiryModalOpen(false)}
        onSubmit={createInquiry}
      />
      <SessionFormModal
        open={sessionModalOpen}
        onClose={() => setSessionModalOpen(false)}
        onSubmit={createSession}
      />
      <InvoiceFormModal
        open={invoiceModalOpen}
        onClose={() => setInvoiceModalOpen(false)}
        onSubmit={createInvoice}
      />
      <TaskFormModal
        open={taskModalDefaultStatus !== null}
        defaultStatus={taskModalDefaultStatus ?? "open"}
        onClose={() => setTaskModalDefaultStatus(null)}
        onSubmit={createTask}
      />
    </main>
  );
}
