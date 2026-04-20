// Stage 10 Booking Check-In Mobile Page Purpose
"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { StudioOsAuthProvider, useStudioOsAuth } from "@/components/studio-os-auth-provider";

const requestKey = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}`);

function BookingCheckInScreen() {
  const { id } = useParams<{ id: string }>();
  const { status, authorizedFetch } = useStudioOsAuth();
  const [booking, setBooking] = useState<Record<string, any> | null>(null);
  const [message, setMessage] = useState<string | null>(null);

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
  };

  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f4efe5_0%,_#ece2d1_100%)] px-4 py-6 text-stone-950">
      <div className="mx-auto max-w-2xl space-y-4">
        <section className="rounded-[2rem] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_60px_rgba(84,65,38,0.1)]">
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-500">Studio check-in</p>
          <h1 className="mt-2 font-serif text-4xl">{booking?.purpose || "Studio booking"}</h1>
          <p className="mt-2 text-sm leading-7 text-stone-600">{booking?.bookingStart} → {booking?.bookingEnd}</p>
          <div className="mt-4 rounded-3xl bg-stone-100 px-4 py-4 text-sm text-stone-700">
            Access code: <span className="font-semibold text-stone-950">{booking?.accessCode || "pending"}</span>
          </div>
        </section>

        <section className="grid gap-3 rounded-[2rem] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_60px_rgba(84,65,38,0.1)]">
          <button type="button" onClick={() => void updateBooking({ status: "in_use", checkinAt: new Date().toISOString() })} className="rounded-2xl bg-stone-950 px-4 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-stone-50">
            Check in now
          </button>
          <button type="button" onClick={() => void updateBooking({ status: "completed", checkoutAt: new Date().toISOString() })} className="rounded-2xl bg-emerald-600 px-4 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-white">
            Complete checkout
          </button>
          <button type="button" onClick={() => void updateBooking({ status: "no_show" })} className="rounded-2xl bg-amber-400 px-4 py-4 text-sm font-semibold uppercase tracking-[0.2em] text-stone-950">
            Mark no-show
          </button>
        </section>

        <section className="rounded-[2rem] border border-stone-200 bg-white/90 p-5 shadow-[0_24px_60px_rgba(84,65,38,0.1)]">
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-500">Status</p>
          <p className="mt-2 text-lg font-semibold text-stone-950">{booking?.status || "Loading..."}</p>
          <p className="mt-2 text-sm text-stone-600">
            Deposit paid: {booking?.depositPaid ? "yes" : "no"} • Check-in: {booking?.checkinAt || "not yet"} • Checkout:{" "}
            {booking?.checkoutAt || "not yet"}
          </p>
          {message ? <p className="mt-3 text-sm text-stone-700">{message}</p> : null}
        </section>
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
