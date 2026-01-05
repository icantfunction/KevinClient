"use client";

import Image from "next/image";
import { MotionConfig, motion } from "framer-motion";

const heroImage =
  "https://images-pw.pixieset.com/elementfield/M4dKMVR/IMG_0876-956971ce-1500.jpg";

const galleryImages = [
  {
    src: "https://images-pw.pixieset.com/elementfield/M4dKMVR/IMG_0962-d8bc538d-1500.jpg",
    alt: "Bride and groom in soft light",
    label: "Soft light editorial",
    ratio: "3 / 4",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/M4dKMVR/IMG_0860-420dae6c-1500.jpg",
    alt: "Couple portrait in quiet interior",
    label: "Quiet portrait",
    ratio: "4 / 5",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/K5X7Lw6/_K1A8093-ef45384d-1500.jpg",
    alt: "Bouquet and bridal details",
    label: "Bouquet study",
    ratio: "2 / 3",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/e4O79yG/_K1A7439-0b10af2c-1500.jpg",
    alt: "Couple embracing at the ceremony",
    label: "Ceremony hush",
    ratio: "4 / 3",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/oven8VP/_K1A8149-e791c03a-1500.jpg",
    alt: "Reception tablescape with candlelight",
    label: "Tablescape detail",
    ratio: "16 / 10",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/ZQa9QxM/IMG_8885-c6cc5bb7-1500.jpg",
    alt: "Dramatic aisle moment",
    label: "Aisle glow",
    ratio: "3 / 4",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/6GyjGVb/IMG_8892-c1655c65-1500.jpg",
    alt: "Bride with veil in motion",
    label: "Veil study",
    ratio: "2 / 3",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/PE35ElD/IMG_9275-1fca3fbc-1500.jpg",
    alt: "Celebration with champagne",
    label: "Celebration",
    ratio: "4 / 5",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/6GyjGv1/IMG_9167-48eb4d11-1500.jpg",
    alt: "Evening portrait under soft light",
    label: "Evening portrait",
    ratio: "3 / 4",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/9JbaGpP/_K1A9845-39532c6a-1500.jpg",
    alt: "Editorial bridal portrait",
    label: "Editorial bride",
    ratio: "4 / 3",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/J3ymQly/_K1A9809-249d16fe-1500.jpg",
    alt: "Garden ceremony detail",
    label: "Garden ceremony",
    ratio: "3 / 5",
  },
  {
    src: "https://images-pw.pixieset.com/elementfield/5ObvzQJ/_K1A9872-351b9691-1500.jpg",
    alt: "Couple on stone steps",
    label: "Stone steps",
    ratio: "5 / 4",
  },
];

const services = [
  {
    title: "Signature Weddings",
    description:
      "Full weekend coverage with editorial direction, timeline support, and a curated gallery delivery.",
  },
  {
    title: "Engagement Portraits",
    description:
      "Location scouting, wardrobe guidance, and artful portraiture with a clean, magazine-led finish.",
  },
  {
    title: "Destination Events",
    description:
      "Multi-day storytelling with travel planning, heirloom albums, and a discreet, attentive presence.",
  },
];

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  visible: { opacity: 1, y: 0 },
};

const transition = {
  duration: 0.9,
  ease: "easeOut",
} as const;

const viewport = { once: true, amount: 0.2 };

const HeroCopy = () => (
  <>
    <p className="eyebrow">Palm Beach + Worldwide</p>
    <h1 className="hero-title" id="hero-title">
      World Wide Events
    </h1>
    <p className="hero-tagline">Editorial wedding photography</p>
    <p className="hero-description">
      World Wide Events crafts minimalist editorial photography for weddings and
      celebrations worldwide, blending calm direction with cinematic framing
      and galleries that read like print.
    </p>
    <div className="hero-actions">
      <a className="button button-primary" href="#work">
        See our work
      </a>
      <a className="text-link" href="#contact">
        Start the conversation
      </a>
    </div>
  </>
);

export default function Home() {
  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen" id="top">
        <header className="site-header">
          <div className="nav-inner">
            <a className="logo" href="#top">
              World Wide Events
            </a>
            <nav className="nav-links" aria-label="Primary">
              <a className="nav-link" href="#about">
                About
              </a>
              <a className="nav-link" href="#work">
                See Our Work
              </a>
              <a className="nav-link" href="#services">
                Services
              </a>
              <a className="nav-link" href="#kind-words">
                Kind Words
              </a>
              <a className="nav-link" href="#contact">
                Contact
              </a>
            </nav>
          </div>
        </header>

        <main>
          <section className="hero" aria-labelledby="hero-title">
            <div className="hero-media">
              <Image
                src={heroImage}
                alt="Bride and groom in an elegant embrace"
                fill
                priority
                sizes="100vw"
              />
            </div>
            <div className="hero-overlay" aria-hidden="true" />
            <motion.div
              className="hero-content"
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              variants={fadeUp}
              transition={transition}
            >
              <HeroCopy />
            </motion.div>
          </section>
          <section className="hero-banner" aria-labelledby="hero-title">
            <motion.div
              className="hero-banner-inner"
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              variants={fadeUp}
              transition={transition}
            >
              <HeroCopy />
            </motion.div>
          </section>

          <section className="section" id="about">
            <div className="intro-grid">
              <motion.div
                className="intro-copy"
                initial="hidden"
                whileInView="visible"
                viewport={viewport}
                variants={fadeUp}
                transition={transition}
              >
                <p className="section-label">The Atelier</p>
                <h2>Minimalist imagery for modern celebrations.</h2>
              </motion.div>
              <motion.div
                className="intro-body"
                initial="hidden"
                whileInView="visible"
                viewport={viewport}
                variants={fadeUp}
                transition={{ ...transition, delay: 0.1 }}
              >
                <p>
                We craft coverage that feels effortless, poised, and deeply
                intentional. Every frame is composed with restraint, allowing
                the emotion to live in the details.
                </p>
                <p>
                  From intimate villas to grand ballrooms, our team delivers a
                  calm, artful presence and a gallery designed to read like a
                  magazine spread.
                </p>
                <div className="signature">World Wide Events Photography</div>
              </motion.div>
            </div>
          </section>

          <section className="section" id="work">
            <motion.div
              className="section-head"
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              variants={fadeUp}
              transition={transition}
            >
              <p className="section-label">See Our Work</p>
              <h2>Curated stories, composed with light and silence.</h2>
            </motion.div>
            <div className="masonry">
              {galleryImages.map((image, index) => (
                <motion.figure
                  key={image.src}
                  className="masonry-item"
                  style={{ aspectRatio: image.ratio }}
                  initial="hidden"
                  whileInView="visible"
                  viewport={viewport}
                  variants={fadeUp}
                  transition={{ ...transition, delay: index * 0.05 }}
                >
                  <Image
                    src={image.src}
                    alt={image.alt}
                    fill
                    sizes="(max-width: 780px) 100vw, (max-width: 1100px) 50vw, 33vw"
                  />
                  <figcaption>{image.label}</figcaption>
                </motion.figure>
              ))}
            </div>
          </section>

          <section className="section" id="services">
            <motion.div
              className="section-head"
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              variants={fadeUp}
              transition={transition}
            >
              <p className="section-label">Services</p>
              <h2>Coverage designed for calm, refined storytelling.</h2>
            </motion.div>
            <div className="services-grid">
              {services.map((service, index) => (
                <motion.div
                  key={service.title}
                  className="service-card"
                  initial="hidden"
                  whileInView="visible"
                  viewport={viewport}
                  variants={fadeUp}
                  transition={{ ...transition, delay: index * 0.1 }}
                >
                  <h3>{service.title}</h3>
                  <p>{service.description}</p>
                </motion.div>
              ))}
            </div>
          </section>

          <section className="section kind-words" id="kind-words">
            <div className="divider" />
            <motion.p
              className="section-label"
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              variants={fadeUp}
              transition={transition}
            >
              Kind Words
            </motion.p>
            <motion.blockquote
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              variants={fadeUp}
              transition={{ ...transition, delay: 0.1 }}
            >
              &quot;Every image felt like a still from a film. The experience
              was calm, intimate, and beyond our hopes.&quot;
            </motion.blockquote>
            <div className="divider" />
            <motion.div
              className="testimonials"
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              variants={fadeUp}
              transition={{ ...transition, delay: 0.15 }}
            >
              <p>
                &quot;They see the quiet moments. The gallery felt like an
                editorial spread of our day.&quot;
              </p>
              <p>
                &quot;From planning to delivery, the process was effortless and
                thoughtful. Pure artistry.&quot;
              </p>
            </motion.div>
          </section>

          <section className="section contact" id="contact">
            <motion.div
              className="contact-card"
              initial="hidden"
              whileInView="visible"
              viewport={viewport}
              variants={fadeUp}
              transition={transition}
            >
              <p className="section-label">Inquire</p>
              <h2>Begin the story with intention.</h2>
              <p>
                Share your date, destination, and vision. We will respond within
                48 hours with a tailored proposal and editorial timeline guide.
              </p>
              <a className="button" href="mailto:hello@worldwideevents.com">
                Start your inquiry
              </a>
            </motion.div>
          </section>
        </main>

        <footer className="site-footer">
          <div className="footer-inner">
            <span>World Wide Events Photography</span>
            <span>Palm Beach, Florida + Worldwide</span>
            <span>Instagram: @worldwide.events</span>
          </div>
        </footer>
      </div>
    </MotionConfig>
  );
}
