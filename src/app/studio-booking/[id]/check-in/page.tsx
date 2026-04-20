// Stage 11.5 Booking Check-In Mobile Page Purpose
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  StudioOsAuthProvider,
  useStudioOsAuth,
} from "@/components/studio-os-auth-provider";

const requestKey = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}`;

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};

const statusPill = (status?: string | null) => {
  const s = (status ?? "").toLowerCase();
  if (s === "confirmed") return "bg-emerald-500/20 text-emerald-200 ring-emerald-400/30";
  if (s === "in_use") return "bg-sky-500/20 text-sky-200 ring-sky-400/30";
  if (s === "completed") return "bg-slate-500/20 text-slate-200 ring-slate-400/30";
  if (s === "no_show") return "bg-rose-500/20 text-rose-200 ring-rose-400/30";
  if (s === "hold") return "bg-amber-500/20 text-amber-200 ring-amber-400/30";
  return "bg-slate-500/20 text-slate-200 ring-slate-400/30";
};

function BookingCheckInScreen() {
  const { id } = useParams<{ id: string }>();
  const { status, authorizedFetch } = useStudioOsAuth();
  const [booking, setBooking] = useState<Record<string, any> | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const loadBooking = async () => {
    const response = await authorizedFetch(`/studio/bookings/${id}`);
    const payload = await response.json();
    setBooking(payload.booking ?? null);
  };

  useEffect(() => {
    if (status === "authenticated" && id) {
      void loadBooking();
    }
  }, [id, status]);

  const updateBooking = async (patch: Record<string, unknown>) => {
    setWorking(true);
    try {
      const response = await authorizedFetch(`/studio/bookings/${id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
          "Idempotency-Key": requestKey(),
        },
        body: JSON.stringify(patch),
      });

      const payload = await response.json();
      setBooking(payload.booking ?? null);
      setMessage(response.ok ? "Booking updated." : "Unable to update booking.");
    } finally {
      setWorking(false);
    }
  };

  const bookingStatus = String(booking?.status ?? "loading");

  return (
    <main className="min-h-screen bg-slate-950 pb-10 text-slate-100">
      <div className="mx-auto max-w-2xl space-y-4 px-4 pt-6">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-400 transition hover:text-white"
          >
            ← Dashboard
          </Link>
          <span
            className={`rounded-full px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.12em] ring-1 ring-inset ${statusPill(bookingStatus)}`}
          >
            {bookingStatus.replace(/_/g, " ")}
          </span>
        </div>

        <section className="rounded-[1.6rem] border border-white/10 bg-gradient-to-br from-slate-900 to-slate-800 p-6">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-400">
            Studio check-in
          </p>
          <h1 className="mt-2 font-serif text-[1.8rem] leading-tight">
            {String(booking?.purpose ?? "Studio booking")}
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            {formatDateTime(booking?.bookingStart)} →{" "}
            {formatDateTime(booking?.bookingEnd)}
          </p>

          <div className="mt-5 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-4">
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-amber-200">
              Access code
            </p>
            <p className="mt-1 font-mono text-3xl tracking-[0.4em] text-amber-100">
              {String(booking?.accessCode ?? "— — — —")}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-white/5 px-3 py-2.5">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Deposit
              </p>
              <p className="mt-0.5 font-semibold">
                {booking?.depositPaid ? "Paid" : "Pending"}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2.5">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Space
              </p>
              <p className="mt-0.5 font-semibold">
                {String(booking?.spaceId ?? "—")}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2.5">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Check-in
              </p>
              <p className="mt-0.5 font-semibold">
                {formatDateTime(booking?.checkinAt)}
              </p>
            </div>
            <div className="rounded-xl bg-white/5 px-3 py-2.5">
              <p className="text-[0.64rem] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Checkout
              </p>
              <p className="mt-0.5 font-semibold">
                {formatDateTime(booking?.checkoutAt)}
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-2.5">
          <button
            type="button"
            disabled={working}
            onClick={() =>
              void updateBooking({
                status: "in_use",
                checkinAt: new Date().toISOString(),
              })
            }
            className="w-full rounded-2xl bg-emerald-400 px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-slate-950 transition hover:brightness-110 disabled:opacity-60"
          >
            ✓ Check in now
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() =>
              void updateBooking({
                status: "completed",
                checkoutAt: new Date().toISOString(),
              })
            }
            className="w-full rounded-2xl bg-white px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-slate-950 transition hover:brightness-95 disabled:opacity-60"
          >
            Complete checkout
          </button>
          <button
            type="button"
            disabled={working}
            onClick={() => void updateBooking({ status: "no_show" })}
            className="w-full rounded-2xl border border-rose-400/40 bg-rose-500/10 px-4 py-4 text-sm font-semibold uppercase tracking-[0.16em] text-rose-200 transition hover:bg-rose-500/20 disabled:opacity-60"
          >
            Mark no-show
          </button>
        </section>

        {message ? (
          <section className="rounded-xl bg-white/10 px-4 py-3 text-sm text-slate-200">
            {message}
          </section>
        ) : null}
      </div>
    </main>
  );
}

export default function BookingCheckInPage() {
  return (
    <StudioOsAuthProvider>
      <BookingCheckInScreen />
    </StudioOsAuthProvider>
  );
}
