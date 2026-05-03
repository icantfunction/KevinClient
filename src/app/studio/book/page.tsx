import type { Metadata } from "next";
import Link from "next/link";
import { bookingSteps, siteConfig } from "@/data/site";

export const metadata: Metadata = {
  title: "Book",
  description:
    "Check availability and book Worldwide Studio Space through HoneyBook.",
};

export default function BookPage() {
  return (
    <main className="section bg-neutral-50 min-h-screen">
      <div className="mx-auto max-w-7xl space-y-12">
        <div className="max-w-2xl">
          <p className="section-kicker">Reserve</p>
          <h1 className="section-title">Secure Your Date</h1>
          <p className="mt-6 text-lg text-neutral-500 font-light">
            View real-time availability and book instantly. For custom requests
            or multi-day productions, feel free to contact us first.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[2fr,1fr]">
          <div className="card overflow-hidden bg-white shadow-xl shadow-neutral-200/50 border-neutral-200">
            <div className="p-1">
              <iframe
                title="Worldwide Studio Space booking"
                src={siteConfig.bookingUrl}
                className="h-[600px] w-full rounded-lg bg-white"
              />
            </div>
            <div className="bg-neutral-50 px-6 py-4 border-t border-neutral-100">
              <p className="text-xs text-neutral-400 text-center">
                Can&apos;t see the calendar?{" "}
                <Link
                  href={siteConfig.bookingUrl}
                  className="underline text-neutral-600 hover:text-black"
                >
                  Open direct booking link
                </Link>
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="card p-8 bg-white">
              <p className="section-kicker !mb-6">The Process</p>
              <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-2 before:w-[1px] before:bg-neutral-200">
                {bookingSteps.map((step, i) => (
                  <div key={step.title} className="relative pl-8">
                    <span className="absolute left-0 top-1 h-[23px] w-[23px] rounded-full bg-white border border-neutral-300 flex items-center justify-center text-[10px] font-bold text-neutral-500">
                      {i + 1}
                    </span>
                    <p className="text-sm font-bold text-neutral-900">
                      {step.title}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-8 bg-neutral-900 text-white border-neutral-800">
              <p className="text-xs uppercase tracking-[0.2em] text-neutral-400 font-bold mb-4">
                Assistance
              </p>
              <p className="text-sm text-neutral-300 leading-relaxed">
                Have questions about the equipment or load-in process?
              </p>
              <div className="mt-6 space-y-2">
                <a
                  className="block text-sm font-medium hover:text-white text-neutral-200 transition"
                  href={`mailto:${siteConfig.contactEmail}`}
                >
                  ✉ {siteConfig.contactEmail}
                </a>
                <p className="text-sm text-neutral-400">☎ {siteConfig.phone}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
