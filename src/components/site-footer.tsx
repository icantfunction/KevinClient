import Link from "next/link";
import { siteConfig } from "@/data/site";

const footerLinks = [
  { href: "/studio/content", label: "For Creators" },
  { href: "/studio/events", label: "For Events" },
  { href: "/studio/gallery", label: "Gallery" },
  { href: "/studio/rates", label: "Rates" },
  { href: "/studio/book", label: "Book" },
];

export default function SiteFooter() {
  return (
    <footer className="border-t border-neutral-200 bg-white pt-20 pb-12">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[2fr,1fr,1fr]">
        <div className="max-w-sm">
          <Link
            href="/studio"
            className="text-sm font-bold uppercase tracking-[0.2em] text-neutral-900"
          >
            {siteConfig.name}
          </Link>
          <p className="mt-6 text-lg font-display text-neutral-800 leading-relaxed">
            A flexible studio and event venue tailored for creative production
            and intimate gatherings.
          </p>
          <div className="mt-8 space-y-1 text-sm text-neutral-500">
            <p>{siteConfig.addressLine}</p>
            <p>
              {siteConfig.city}, {siteConfig.state}
            </p>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
            Explore
          </p>
          <ul className="mt-6 space-y-3 text-sm text-neutral-600">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="transition hover:text-black hover:translate-x-1 inline-block"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">
            Connect
          </p>
          <ul className="mt-6 space-y-3 text-sm text-neutral-600">
            <li>
              <a
                href={`mailto:${siteConfig.contactEmail}`}
                className="hover:text-black transition"
              >
                {siteConfig.contactEmail}
              </a>
            </li>
            <li>
              <p>{siteConfig.phone}</p>
            </li>
            <li>
              <a
                href={siteConfig.instagramUrl}
                className="hover:text-black transition inline-flex items-center gap-2"
              >
                Instagram ↗
              </a>
            </li>
            <li>
              <Link
                href="/studio/contact"
                className="hover:text-black transition"
              >
                Contact Form
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-20 border-t border-neutral-100 pt-8 text-center text-[0.65rem] uppercase tracking-[0.2em] text-neutral-400">
        <p>
          © {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
