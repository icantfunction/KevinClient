// Stage 10 Studio Preview Page Purpose
import Link from "next/link";
import { foldedStudioSource } from "@/lib/studio-source";
import { studioOsRuntimeConfig } from "@/lib/studio-os-config";

export default function StudioPreviewPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,_#f4efe5_0%,_#ece2d1_100%)] px-5 py-8 text-stone-950">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[2rem] border border-stone-900 bg-stone-950 px-8 py-10 text-stone-100 shadow-[0_30px_120px_rgba(0,0,0,0.28)]">
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-300">Folded studio source</p>
          <h1 className="mt-4 max-w-4xl font-serif text-5xl leading-[0.94] lg:text-7xl">{foldedStudioSource.name}</h1>
          <p className="mt-5 max-w-3xl text-base leading-8 text-stone-300">{foldedStudioSource.strapline}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="rounded-full bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-950">
              Back to admin
            </Link>
            <a
              href={`${studioOsRuntimeConfig.apiUrl}/studio/page`}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-white/20 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-stone-100"
            >
              Open live public endpoint
            </a>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.05fr,0.95fr]">
          <div className="rounded-[1.8rem] border border-stone-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(84,65,38,0.08)]">
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-500">Rates</p>
            <div className="mt-4 grid gap-3">
              {foldedStudioSource.rates.map((rate) => (
                <div key={rate.label} className="rounded-3xl border border-stone-200 bg-stone-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-semibold text-stone-950">{rate.label}</p>
                    <span className="font-serif text-2xl text-stone-950">{rate.price}</span>
                  </div>
                  <p className="mt-2 text-sm text-stone-600">{rate.details}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[1.8rem] border border-stone-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(84,65,38,0.08)]">
            <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-500">Amenities</p>
            <div className="mt-4 grid gap-3">
              {foldedStudioSource.amenities.map((amenity) => (
                <div key={amenity} className="rounded-3xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                  {amenity}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="rounded-[1.8rem] border border-stone-200 bg-white/88 p-6 shadow-[0_20px_60px_rgba(84,65,38,0.08)]">
          <p className="text-[0.68rem] uppercase tracking-[0.28em] text-stone-500">Use cases</p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {foldedStudioSource.useCases.map((useCase) => (
              <div key={useCase.title} className="rounded-3xl border border-stone-200 bg-stone-50 p-5">
                <p className="font-semibold text-stone-950">{useCase.title}</p>
                <p className="mt-3 text-sm leading-7 text-stone-600">{useCase.description}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
