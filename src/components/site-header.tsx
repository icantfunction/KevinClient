import Link from "next/link";
import { siteConfig } from "@/data/site";

const navLinks = [
  { href: "/studio/gallery", label: "Gallery" },
  { href: "/studio/rates", label: "Rates" },
  { href: "/studio/amenities", label: "Amenities" },
  { href: "/studio/policies", label: "Policies" },
  { href: "/studio/faq", label: "FAQ" },
  { href: "/studio/contact", label: "Contact" },
];

export default function SiteHeader() {
  return (
    <header className="glass sticky top-0 z-50 border-b border-black/5 transition-all">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link
          href="/studio"
          className="text-sm font-bold uppercase tracking-[0.2em] transition hover:opacity-70"
        >
          {siteConfig.name}
        </Link>
        <nav className="hidden items-center gap-8 text-[0.7rem] uppercase tracking-[0.2em] font-medium text-neutral-600 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="transition hover:text-black"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/studio/book"
            className="btn btn-primary !px-5 !py-2 !text-[0.65rem]"
          >
            Book Now
          </Link>
        </div>
      </div>
      <nav className="flex gap-6 overflow-x-auto px-6 py-3 text-[0.65rem] uppercase tracking-[0.2em] text-neutral-500 md:hidden scrollbar-hide">
        {navLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="whitespace-nowrap transition hover:text-black"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
