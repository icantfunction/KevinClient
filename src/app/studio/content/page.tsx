import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { highlights } from "@/data/highlights";
import { rates } from "@/data/rates";

export const metadata: Metadata = {
  title: "Content Studio",
  description:
    "Book Worldwide Studio Space for content creation, photo shoots, podcasts, and productions.",
};

export default function ContentPage() {
  return (
    <main>
      <section className="section">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
          <div className="space-y-6">
            <p className="section-kicker">For creators</p>
            <h1 className="section-title">Content-ready, on demand.</h1>
            <p className="text-lg text-neutral-600">
              Book the studio for photo shoots, interviews, podcasts, and
              campaign productions. Natural light, grip gear, and a quiet setup
              help you move fast.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/studio/book"
                className="rounded-full bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white"
              >
                Book a content day
              </Link>
              <Link
                href="/studio/rates"
                className="rounded-full border border-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em]"
              >
                View rates
              </Link>
            </div>
          </div>
          <div className="hero-media">
            <Image
              src="/media/space-1.svg"
              alt="Content studio"
              width={640}
              height={520}
            />
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <p className="section-kicker">Why creators book here</p>
            <h2 className="section-title">Built for modern production.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {highlights.slice(0, 6).map((item) => (
              <div key={item.title} className="card p-6">
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="mx-auto max-w-6xl space-y-6">
          <div>
            <p className="section-kicker">Rates snapshot</p>
            <h2 className="section-title">Simple hourly pricing.</h2>
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
        </div>
      </section>
    </main>
  );
}
