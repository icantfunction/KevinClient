// Stage 10 PWA Manifest Purpose
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Kevin's Studio OS",
    short_name: "Studio OS",
    description: "Kevin's unified photography and studio operations dashboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4efe5",
    theme_color: "#1d1d1d",
    icons: [
      {
        src: "/app-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/app-icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
