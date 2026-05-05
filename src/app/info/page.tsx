import type { Metadata } from "next";
import Link from "next/link";
import { services } from "@/lib/gallery";
import { siteConfig } from "@/lib/site-config";

export const metadata: Metadata = {
  title: "Info",
  description:
    "About World Wide Events — approach, services, and the experience of working with the studio.",
};

export default function InfoPage() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">About</p>
        <h1>Editorial coverage with quiet intention.</h1>
        <p>
          A small studio with a calm, attentive presence — devoted to weddings
          and events that feel as elevated in the gallery as they did in the
          room.
        </p>
      </header>

      <section className="section">
        <div className="about-grid">
          <div>
            <p className="eyebrow">The approach</p>
            <h2
              className="display-serif"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginTop: "1.2rem" }}
            >
              We see the quiet moments other lenses miss.
            </h2>
          </div>
          <div className="body-prose">
            <p>
              World Wide Events crafts editorial wedding photography blending
              calm direction with cinematic framing. We arrive early, move
              softly, and compose every frame with restraint — letting emotion
              live in the details rather than the staging.
            </p>
            <p>
              Each gallery is hand-edited as if it were going to print. Skin
              tones are honest, color holds across the day, and the final
              delivery reads like a quiet editorial spread of the wedding —
              not a highlight reel.
            </p>
            <p>
              Based between Palm Beach and Miami; available for destinations
              worldwide.
            </p>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <p className="eyebrow" style={{ marginBottom: "2rem" }}>
          Services
        </p>
        <div className="services">
          {services.map((service) => (
            <article key={service.title} className="service">
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="about-grid">
          <div>
            <p className="eyebrow">The experience</p>
            <h2
              className="display-serif"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginTop: "1.2rem" }}
            >
              Calm from inquiry to delivery.
            </h2>
          </div>
          <div className="body-prose">
            <p>
              <strong>1. Inquiry.</strong> Tell us your date, destination, and
              vision. We&rsquo;ll respond within 48 hours with a tailored
              proposal and a timeline guide built around your day.
            </p>
            <p>
              <strong>2. Planning.</strong> A walkthrough call and an
              editorial-style mood board to align on light, locations, and the
              moments that matter most to you.
            </p>
            <p>
              <strong>3. The day.</strong> Discreet, attentive coverage that
              keeps you present. We work alongside your planner and stay out of
              the way of your guests.
            </p>
            <p>
              <strong>4. Delivery.</strong> A hand-edited gallery delivered as
              a private editorial collection, with optional fine-art prints and
              heirloom albums.
            </p>
          </div>
        </div>
      </section>

      <section className="cta-band">
        <h2>Ready to share your date?</h2>
        <p>
          Reach out at{" "}
          <a
            href={`mailto:${siteConfig.email}`}
            style={{ borderBottom: "1px solid currentColor" }}
          >
            {siteConfig.email}
          </a>{" "}
          or send the inquiry form.
        </p>
        <Link href="/contact" className="btn btn-filled">
          Inquire
        </Link>
      </section>
    </main>
  );
}
