import type { Metadata } from "next";
import { policies } from "@/data/policies";

export const metadata: Metadata = {
  title: "Policies",
  description:
    "Review booking, cancellation, and event policies for Worldwide Studio Space.",
};

export default function PoliciesPage() {
  return (
    <main className="section">
      <div className="mx-auto max-w-5xl space-y-8">
        <div>
          <p className="section-kicker">Policies</p>
          <h1 className="section-title">Rules that keep bookings smooth</h1>
          <p className="mt-3 text-sm text-neutral-600">
            We keep policies clear so you can plan with confidence.
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2">
          {policies.map((policy) => (
            <div key={policy.title} className="card p-6">
              <h2 className="text-lg font-semibold">{policy.title}</h2>
              <p className="mt-2 text-sm text-neutral-600">{policy.details}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
