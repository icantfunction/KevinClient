import type { Metadata } from "next";
import { addOns, rateNotes, rates } from "@/data/rates";

export const metadata: Metadata = {
  title: "Rates",
  description:
    "View studio rental rates, event pricing, and add-ons for Worldwide Studio Space.",
};

export default function RatesPage() {
  return (
    <main className="section">
      <div className="mx-auto max-w-6xl space-y-10">
        <div>
          <p className="section-kicker">Rates</p>
          <h1 className="section-title">Studio + event pricing</h1>
          <p className="mt-3 text-sm text-neutral-600">
            Transparent pricing with minimums, deposits, and optional add-ons.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {rates.map((rate) => (
            <div key={rate.label} className="card p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                {rate.label}
              </p>
              <p className="mt-3 text-2xl font-semibold">{rate.price}</p>
              <p className="mt-2 text-sm text-neutral-600">{rate.details}</p>
            </div>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.2fr,0.8fr]">
          <div className="card p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
              Booking details
            </p>
            <ul className="mt-4 space-y-2 text-sm text-neutral-600">
              {rateNotes.map((note) => (
                <li key={note}>• {note}</li>
              ))}
            </ul>
          </div>
          <div className="card p-6">
            <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
              Add-ons
            </p>
            <div className="mt-4 space-y-4">
              {addOns.map((addOn) => (
                <div key={addOn.item}>
                  <div className="flex items-center justify-between text-sm font-semibold">
                    <span>{addOn.item}</span>
                    <span>{addOn.price}</span>
                  </div>
                  <p className="text-xs text-neutral-500">{addOn.notes}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
