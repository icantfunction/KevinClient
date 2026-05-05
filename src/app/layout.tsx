import type { Metadata } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/smooth-scroll";
import SiteNav from "@/components/site-nav";
import SiteFooter from "@/components/site-footer";
import { siteConfig } from "@/lib/site-config";

const bodoni = Bodoni_Moda({
  subsets: ["latin"],
  variable: "--font-bodoni",
  weight: ["400", "500"],
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${siteConfig.name} — Editorial Wedding Photography`,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${bodoni.variable}`}>
      <body className="antialiased">
        <SmoothScroll />
        <SiteNav />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
