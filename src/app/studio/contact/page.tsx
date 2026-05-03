import type { Metadata } from "next";
import { siteConfig } from "@/data/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact Worldwide Studio Space for booking questions.",
};

export default function ContactPage() {
  const mapQuery = encodeURIComponent(siteConfig.addressLine);
  return (
    <main className="section">
      <div className="mx-auto max-w-6xl space-y-10">
        <div>
          <p className="section-kicker">Contact</p>
          <h1 className="section-title">Let&rsquo;s confirm your date.</h1>
          <p className="mt-3 text-sm text-neutral-600">
            Share your details and we will respond quickly with availability.
          </p>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
          <form
            className="card space-y-4 p-6"
            action={`mailto:${siteConfig.contactEmail}`}
            method="post"
            encType="text/plain"
          >
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                Name
              </label>
              <input
                name="name"
                required
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm"
                placeholder="Your name"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                Email
              </label>
              <input
                type="email"
                name="email"
                required
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm"
                placeholder="you@email.com"
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                Booking type
              </label>
              <select
                name="bookingType"
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm"
              >
                <option>Content / Production</option>
                <option>Event / Celebration</option>
                <option>Unsure</option>
              </select>
            </div>
            <div>
              <label className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                Message
              </label>
              <textarea
                name="message"
                rows={4}
                className="mt-2 w-full rounded-xl border border-black/10 px-4 py-3 text-sm"
                placeholder="Dates, guest count, and any add-ons needed."
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-full bg-black px-6 py-3 text-xs font-semibold uppercase tracking-[0.3em] text-white"
            >
              Send inquiry
            </button>
            <p className="text-xs text-neutral-500">
              Prefer direct booking? Use HoneyBook for instant availability.
            </p>
          </form>
          <div className="space-y-4">
            <div className="card p-6">
              <p className="text-xs uppercase tracking-[0.3em] text-neutral-500">
                Contact details
              </p>
              <div className="mt-4 space-y-2 text-sm text-neutral-600">
                <p>{siteConfig.addressLine}</p>
                <p>{siteConfig.phone}</p>
                <p>
                  <a
                    className="underline"
                    href={`mailto:${siteConfig.contactEmail}`}
                  >
                    {siteConfig.contactEmail}
                  </a>
                </p>
              </div>
            </div>
            <div className="card overflow-hidden">
              <iframe
                title="Worldwide Studio Space map"
                src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                className="h-64 w-full border-0"
                loading="lazy"
              />
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
