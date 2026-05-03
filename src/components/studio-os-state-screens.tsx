"use client";

import Link from "next/link";

export function StudioOsLoadingScreen({
  title = "Loading Studio OS",
  description = "Syncing your workspace.",
}: {
  readonly title?: string;
  readonly description?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.35)]">
        <div className="flex items-center gap-3">
          <span className="relative flex h-3.5 w-3.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-slate-400/50" />
            <span className="relative inline-flex h-3.5 w-3.5 rounded-full bg-slate-900" />
          </span>
          <p className="text-sm font-medium text-slate-900">{title}</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </main>
  );
}

export function StudioOsAuthRequiredScreen({
  href,
  title,
  description,
  actionLabel = "Sign in from dashboard",
}: {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly actionLabel?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6 text-slate-900">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_18px_50px_-32px_rgba(15,23,42,0.35)]">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-400">
          Authentication required
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
        <Link
          href={href}
          className="mt-5 inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:border-slate-400 hover:bg-slate-50"
        >
          {actionLabel}
        </Link>
      </div>
    </main>
  );
}
