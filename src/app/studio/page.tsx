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

        <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)]">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Location & contact
            </p>
            <h2 className="mt-1 font-serif text-2xl">Find us</h2>
            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Studio
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700">
                  {foldedStudioSource.contact.address.street}
                  <br />
                  {foldedStudioSource.contact.address.cityLine}
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Service area
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700">
                  {foldedStudioSource.contact.serviceArea}
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Bookings
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700">
                  <a
                    href={`mailto:${foldedStudioSource.contact.bookingEmail}`}
                    className="text-slate-900 underline-offset-4 hover:underline"
                  >
                    {foldedStudioSource.contact.bookingEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Phone
                </dt>
                <dd className="mt-1 text-sm leading-6 text-slate-700">
                  <a
                    href={`tel:${foldedStudioSource.contact.phone.replace(/[^+\d]/g, "")}`}
                    className="text-slate-900 underline-offset-4 hover:underline"
                  >
                    {foldedStudioSource.contact.phone}
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)]">
            <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
              Hours
            </p>
            <h2 className="mt-1 font-serif text-2xl">When you can shoot</h2>
            <ul className="mt-4 space-y-2.5">
              {foldedStudioSource.hours.map((slot) => (
                <li
                  key={slot.day}
                  className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200"
                >
                  <span className="font-semibold text-slate-900">{slot.day}</span>
                  <span className="text-slate-700">
                    {slot.windows.join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              Off-hours and overnight blocks available with 48 hours notice.
            </p>
          </div>
        </section>

        <section className="rounded-[2rem] bg-gradient-to-br from-amber-50 via-white to-white p-8 ring-1 ring-amber-200/60 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-amber-700">
            Book the studio
          </p>
          <h2 className="mt-1 font-serif text-3xl text-slate-900">
            Lock in your shoot
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Email or text Kevin with your shoot date, hours, and what you&rsquo;re shooting.
            You&rsquo;ll get a quote, a Smart File contract, and an access code on
            the day of your booking.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <a
              href={`mailto:${foldedStudioSource.contact.bookingEmail}?subject=Studio%20booking%20inquiry`}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Email to book
              <span aria-hidden>→</span>
            </a>
            <a
              href={`tel:${foldedStudioSource.contact.phone.replace(/[^+\d]/g, "")}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Call {foldedStudioSource.contact.phone}
            </a>
            <a
              href={`sms:${foldedStudioSource.contact.smsLine.replace(/[^+\d]/g, "")}`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Text instead
            </a>
          </div>
          <ul className="mt-6 grid gap-2.5 text-sm text-slate-700 sm:grid-cols-2 lg:grid-cols-3">
            {foldedStudioSource.bookingNotes.map((note) => (
              <li
                key={note}
                className="flex items-start gap-2.5 rounded-xl bg-white/80 px-3.5 py-3 ring-1 ring-amber-200/60"
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500"
                />
                <span className="leading-6">{note}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl bg-white p-6 ring-1 ring-slate-200 shadow-[0_8px_24px_-18px_rgba(15,23,42,0.3)]">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.24em] text-slate-500">
            FAQ
          </p>
          <h2 className="mt-1 font-serif text-2xl">Common questions</h2>
          <div className="mt-5 divide-y divide-slate-100">
            {foldedStudioSource.faq.map((entry) => (
              <details
                key={entry.question}
                className="group py-3.5 [&_summary::-webkit-details-marker]:hidden"
              >
                <summary className="flex cursor-pointer items-start justify-between gap-4 text-sm font-semibold text-slate-900">
                  {entry.question}
                  <span
                    aria-hidden
                    className="mt-0.5 inline-flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition group-open:rotate-45 group-open:bg-slate-900 group-open:text-white"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-2.5 text-sm leading-6 text-slate-600">
                  {entry.answer}
                </p>
              </details>
            ))}
          </div>
        </section>

        <footer className="rounded-2xl bg-slate-900 p-6 text-center text-sm text-slate-300 ring-1 ring-slate-800">
          {foldedStudioSource.name} · Studio rental in {foldedStudioSource.contact.address.cityLine}
        </footer>
      </div>
    </main>
  );
}
