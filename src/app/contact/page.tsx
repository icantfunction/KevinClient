import type { Metadata } from "next";
import Image from "next/image";
import { siteConfig } from "@/lib/site-config";
import { heroImage } from "@/lib/gallery";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Inquire about wedding and event photography with World Wide Events. Responses within 48 hours.",
};

// ---------------------------------------------------------------------------
// FORM SUBMISSION
//
// The form below currently uses a `mailto:` action so it works the moment the
// site deploys (it will open the visitor's mail client pre-filled with the
// fields). To upgrade to a real backend submission:
//
//   1) Formspree / Web3Forms / Basin (5 min, no infra):
//        change `action="mailto:..."` to your provided POST endpoint
//        change `method="post" encType="text/plain"` to `method="POST"`
//        keep the same field `name=` attributes
//
//   2) Next.js API route + Resend / Postmark / SES:
//        create app/api/inquire/route.ts that accepts a POST and emails you
//        change `action` to "/api/inquire" and `method` to "POST"
//        switch the form to a client component that handles the response
//
// Field `name` attributes are intentionally human-readable so they show up
// well-formatted in the resulting email regardless of the backend used.
// ---------------------------------------------------------------------------

export default function ContactPage() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">Contact</p>
        <h1>Begin the story.</h1>
        <p>
          Share your date, destination, and a few details about the day.
          We&rsquo;ll respond within 48 hours with a tailored proposal and a
          timeline guide.
        </p>
      </header>

      <section className="contact-grid">
        <div className="contact-image">
          <Image
            src={heroImage.src}
            alt={heroImage.alt}
            fill
            sizes="(max-width: 900px) 100vw, 45vw"
          />
        </div>

        <div className="contact-form-wrap">
          <p className="eyebrow">Inquiry form</p>
          <h2
            className="display-serif"
            style={{ fontSize: "clamp(1.8rem, 3.6vw, 2.6rem)", marginTop: "1rem" }}
          >
            Tell us about your day.
          </h2>
          <p style={{ marginTop: "1rem", color: "var(--ink-soft)" }}>
            Prefer to reach out directly? Email{" "}
            <a
              href={`mailto:${siteConfig.email}`}
              style={{ borderBottom: "1px solid currentColor" }}
            >
              {siteConfig.email}
            </a>{" "}
            or call{" "}
            <a
              href={`tel:${siteConfig.phoneTel}`}
              style={{ borderBottom: "1px solid currentColor" }}
            >
              {siteConfig.phone}
            </a>
            .
          </p>

          <form
            className="contact-form"
            action={`mailto:${siteConfig.email}?subject=${encodeURIComponent(
              "World Wide Events — wedding inquiry",
            )}`}
            method="post"
            encType="text/plain"
          >
            <div className="row">
              <div className="field">
                <label htmlFor="name">Your name</label>
                <input
                  id="name"
                  name="Your name"
                  type="text"
                  required
                  autoComplete="name"
                />
              </div>
              <div className="field">
                <label htmlFor="partner">Partner&rsquo;s name</label>
                <input
                  id="partner"
                  name="Partner's name"
                  type="text"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  name="Email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </div>
              <div className="field">
                <label htmlFor="phone">Phone</label>
                <input
                  id="phone"
                  name="Phone"
                  type="tel"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="event-date">Event date</label>
                <input id="event-date" name="Event date" type="date" />
              </div>
              <div className="field">
                <label htmlFor="event-location">Event location</label>
                <input
                  id="event-location"
                  name="Event location"
                  type="text"
                  placeholder="City, venue, or general region"
                />
              </div>
            </div>

            <div className="row">
              <div className="field">
                <label htmlFor="event-type">Event type</label>
                <select id="event-type" name="Event type" defaultValue="">
                  <option value="" disabled>
                    Select one
                  </option>
                  <option>Wedding</option>
                  <option>Engagement portraits</option>
                  <option>Destination event</option>
                  <option>Editorial / branded shoot</option>
                  <option>Other celebration</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="package">Package interest</label>
                <select id="package" name="Package interest" defaultValue="">
                  <option value="" disabled>
                    Select one
                  </option>
                  <option>Full-day wedding coverage</option>
                  <option>Half-day wedding coverage</option>
                  <option>Engagement session</option>
                  <option>Multi-day destination</option>
                  <option>Custom — tell us in the message</option>
                </select>
              </div>
            </div>

            <div className="field">
              <label htmlFor="message">Tell us about your day</label>
              <textarea
                id="message"
                name="Message"
                rows={5}
                placeholder="Vision, guest count, planner, anything that helps us picture the day."
              />
            </div>

            <button
              type="submit"
              className="btn btn-filled"
              style={{ justifySelf: "start" }}
            >
              Submit inquiry
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
