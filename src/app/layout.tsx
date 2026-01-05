import type { Metadata } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import "./globals.css";
import SmoothScroll from "@/components/smooth-scroll";

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
  title: "World Wide Events | Minimalist Editorial Photography",
  description:
    "World Wide Events crafts minimalist editorial photography for weddings, celebrations, and destination events worldwide.",
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
        {children}
      </body>
    </html>
  );
}
