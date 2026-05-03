import type { Metadata } from "next";
import { Bodoni_Moda, Manrope } from "next/font/google";
import "./globals.css";
import PwaRegister from "@/components/pwa-register";

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
    default: "Kevin Ramos",
    template: "%s | Kevin Ramos",
  },
  description:
    "Photography, studio rental, and creator operations by Kevin Ramos.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} ${bodoni.variable}`}>
      <body className="antialiased">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
