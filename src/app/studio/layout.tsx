import type { Metadata } from "next";
import { siteConfig, seoKeywords } from "@/data/site";
import SiteFooter from "@/components/site-footer";
import SiteHeader from "@/components/site-header";
import StickyBookButton from "@/components/sticky-book-button";

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.siteUrl),
  title: {
    default: "Worldwide Studio Space | Studio + Event Venue",
    template: "%s | Worldwide Studio Space",
  },
  description: siteConfig.description,
  keywords: seoKeywords,
  openGraph: {
    title: "Worldwide Studio Space",
    description: siteConfig.description,
    url: siteConfig.siteUrl,
    siteName: siteConfig.name,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Worldwide Studio Space",
    description: siteConfig.description,
  },
};

export default function StudioLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="wss-shell">
      <SiteHeader />
      {children}
      <SiteFooter />
      <StickyBookButton />
    </div>
  );
}
