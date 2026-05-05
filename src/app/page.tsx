import Image from "next/image";
import Link from "next/link";
import { siteConfig } from "@/lib/site-config";
import { galleryImages, heroImage } from "@/lib/gallery";

export default function HomePage() {
  const previewImages = galleryImages.slice(0, 6);

  return (
    <main>
      {/* Hero */}
      <section className="hero">
        <div className="hero-media">
          <Image
            src={heroImage.src}
            alt={heroImage.alt}
            fill
            priority
            sizes="100vw"
          />
        </div>
        <div className="hero-overlay" aria-hidden />
        <div className="hero-content">
          <p className="eyebrow">Palm Beach · Miami · Worldwide</p>
          <h1 className="hero-headline">{siteConfig.tagline}</h1>
          <p className="hero-sub">
            Editorial coverage of weddings, engagements, and destination
            celebrations — captured with calm direction and cinematic framing.
          </p>
          <div className="hero-actions">
            <Link href="/galleries" className="btn btn-ghost">
              View galleries
            </Link>
            <Link href="/contact" className="btn btn-filled">
              Inquire
            </Link>
          </div>
        </div>
      </section>

      {/* Tagline panel */}
      <section className="tagline-panel">
        <p className="eyebrow">World Wide Events stands for</p>
        <h2>Stories worth keeping. Told anywhere in the world.</h2>
        <p className="tagline-sub">
          From the first look to the last dance, every frame is composed with
          restraint — letting emotion live in the details and the gallery read
          like a print edition.
        </p>
      </section>

      {/* Gallery preview — full bleed grid */}
      <section className="section-bleed">
        <div className="image-grid">
          {previewImages.map((image) => (
            <figure key={image.src}>
              <Image
                src={image.src}
                alt={image.alt}
                width={1200}
                height={1500}
                sizes="(max-width: 600px) 100vw, (max-width: 1100px) 50vw, 33vw"
              />
            </figure>
          ))}
        </div>
        <div className="section-tight" style={{ textAlign: "center" }}>
          <Link href="/galleries" className="btn btn-outline">
            See full gallery
          </Link>
        </div>
      </section>

      {/* About blurb */}
      <section className="section">
        <div className="about-grid">
          <div>
            <p className="eyebrow">The atelier</p>
            <h2
              className="display-serif"
              style={{ fontSize: "clamp(2rem, 4vw, 3rem)", marginTop: "1.2rem" }}
            >
              Minimalist imagery for modern celebrations.
            </h2>
          </div>
          <div className="body-prose">
            <p>
              World Wide Events crafts coverage that feels effortless, poised,
              and deeply intentional. Every frame is composed with restraint,
              allowing the emotion to live in the details.
            </p>
            <p>
              From intimate villas to grand ballrooms, our team delivers a
              calm, artful presence and a gallery designed to read like a
              magazine spread.
            </p>
            <Link
              href="/info"
              className="btn btn-outline"
              style={{ marginTop: "1.6rem" }}
            >
              About + services
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA band */}
      <section className="cta-band">
        <h2>Begin the story with intention.</h2>
        <p>
          Share your date, destination, and vision. We respond within 48 hours
          with a tailored proposal and editorial timeline guide.
        </p>
        <Link href="/contact" className="btn btn-filled">
          Secure your date
        </Link>
      </section>
    </main>
  );
}
