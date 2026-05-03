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
  title: "Kevin's Studio OS",
  description:
    "Unified operations dashboard for Kevin's photography practice and creator studio.",
  manifest: "/manifest.webmanifest",
  applicationName: "Kevin's Studio OS",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Studio OS",
  },
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
