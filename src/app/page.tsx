import type { Metadata } from "next";
import PhotographyHome from "@/components/photography-home";

export const metadata: Metadata = {
  title: "World Wide Events Photography",
  description:
    "Editorial wedding photography by World Wide Events — Palm Beach, Florida and worldwide.",
};

export default function HomePage() {
  return <PhotographyHome />;
}
