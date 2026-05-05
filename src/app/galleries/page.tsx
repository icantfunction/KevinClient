import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { galleryImages } from "@/lib/gallery";

export const metadata: Metadata = {
  title: "Galleries",
  description:
    "Selected wedding, engagement, and destination event imagery by World Wide Events.",
};

export default function GalleriesPage() {
  return (
    <main>
      <header className="page-header">
        <p className="eyebrow">Galleries</p>
        <h1>Selected work</h1>
        <p>
          A curated edit of weddings and editorial events captured with calm
          direction and cinematic framing.
        </p>
      </header>

      <section className="section-bleed">
        <div className="image-grid">
          {galleryImages.map((image) => (
            <figure key={image.src} aria-label={image.label}>
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
      </section>

      <section className="cta-band">
        <h2>Bring your story into focus.</h2>
        <p>
          Available for weddings, engagements, and destination events
          worldwide.
        </p>
        <Link href="/contact" className="btn btn-filled">
          Inquire
        </Link>
      </section>
    </main>
  );
}
