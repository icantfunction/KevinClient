// Stage 11.5 Studio Preview Page Purpose
import Link from "next/link";
import { foldedStudioSource } from "@/lib/studio-source";
import { studioOsRuntimeConfig } from "@/lib/studio-os-config";

export default function StudioPreviewPage() {
  return (
    <main className="min-h-screen bg-slate-50 pb-14 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-6 px-5 pt-6 lg:px-8">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-slate-500 transition hover:text-slate-900"
          >
            ← Dashboard
          </Link>
          <a
            href={`${studioOsRuntimeConfig.apiUrl}/studio/page`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-300"
          >
            Live public endpoint
            <span aria-hidden>↗</span>
          </a>
        </div>

        <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 px-8 py-12 text-slate-100 shadow-[0_40px_120px_-30px_rgba(15,23,42,0.4)]">
          <div className="absolute -top-24 -right-16 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl" />
          <div className="relative max-w-3xl">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-slate-300">
              Folded studio source
            </p>
            <h1 className="mt-4 font-serif text-5xl leading-[1.02] tracking-tight lg:text-6xl">
              {foldedStudioSource.name}
            </h1>
            <p className="mt-5 text-base leading-7 text-slate-300 lg:text-lg">
              {foldedStudioSource.strapline}
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)]">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Rates
            </p>
            <h2 className="mt-1 font-serif text-2xl">Rental pricing</h2>
            <div className="mt-4 grid gap-3">
              {foldedStudioSource.rates.map((rate) => (
                <div
                  key={rate.label}
                  className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-slate-900">
                      {rate.label}
                    </p>
                    <span className="font-serif text-xl text-slate-900">
                      {rate.price}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {rate.details}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)]">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Amenities
            </p>
            <h2 className="mt-1 font-serif text-2xl">On-site</h2>
            <ul className="mt-4 grid gap-2">
              {foldedStudioSource.amenities.map((amenity) => (
                <li
                  key={amenity}
                  className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-700 ring-1 ring-slate-200"
                >
                  <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-500" />
                  <span>{amenity}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
            Use cases
          </p>
          <h2 className="mt-1 font-serif text-2xl">What fits here</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-3">
            {foldedStudioSource.useCases.map((useCase) => (
              <div
                key={useCase.title}
                className="rounded-xl bg-gradient-to-br from-slate-50 to-white p-5 ring-1 ring-slate-200"
              >
                <p className="font-semibold text-slate-900">{useCase.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {useCase.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
