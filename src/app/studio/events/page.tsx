import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { amenities } from "@/data/amenities";
import { rates } from "@/data/rates";

export const metadata: Metadata = {
  title: "Event Space",
  description:
    "Host showers, workshops, celebrations, and brand events at Worldwide Studio Space.",
};

export default function EventsPage() {
  return (
    <main>
      <section className="section">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1.1fr,0.9fr] lg:items-center">
          <div className="space-y-6">
            <p className="section-kicker">For events</p>
            <h1 className="section-title">A venue that feels effortless.</h1>
            <p className="text-lg text-neutral-600">
              Host showers, workshops, brand pop-ups, and intimate celebrations
              with flexible layouts, clean lines, and a polished guest
              experience.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                href="/studio/book"
                className="rounded-full bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white"
              >
                Book your event
              </Link>
              <Link
                href="/studio/policies"
                className="rounded-full border border-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em]"
              >
                View policies
              </Link>
            </div>
          </div>
          <div className="hero-media">
            <Image
              src="/media/space-3.svg"
              alt="Event venue layout"
              width={640}
              height={520}
            />
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="mx-auto max-w-6xl space-y-8">
          <div>
            <p className="section-kicker">Event-ready</p>
            <h2 className="section-title">Amenities for hosts and guests.</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {amenities.slice(0, 6).map((amenity) => (
              <div key={amenity.name} className="card p-6">
                <h3 className="text-lg font-semibold">{amenity.name}</h3>
                <p className="mt-2 text-sm text-neutral-600">
                  {amenity.description}
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
            <h2 className="section-title">Flexible event pricing.</h2>
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
