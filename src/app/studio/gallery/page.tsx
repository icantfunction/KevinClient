import type { Metadata } from "next";
import Image from "next/image";
import { galleryItems } from "@/data/gallery";

export const metadata: Metadata = {
  title: "Gallery",
  description:
    "Browse photos and video previews of Worldwide Studio Space for content and events.",
};

export default function GalleryPage() {
  return (
    <main className="section min-h-screen">
      <div className="mx-auto max-w-7xl space-y-12">
        <div className="max-w-2xl">
          <p className="section-kicker">Visuals</p>
          <h1 className="section-title">The Space in Detail</h1>
          <p className="mt-6 text-lg text-neutral-500 font-light">
            Explore our daylight studio, cyclorama wall, and modular event
            layouts. All images represent the current state of the studio.
          </p>
        </div>

        <div className="columns-1 gap-6 space-y-6 sm:columns-2 lg:columns-3">
          {galleryItems.map((item) => (
            <div
              key={item.id}
              className="card break-inside-avoid overflow-hidden group"
            >
              {item.type === "image" ? (
                <div className="relative overflow-hidden">
                  <Image
                    src={item.src}
                    alt={item.alt ?? item.title}
                    width={800}
                    height={600}
                    className="w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 transition duration-500 group-hover:bg-black/10"></div>
                </div>
              ) : (
                <div className="relative overflow-hidden">
                  <Image
                    src={item.poster ?? "/media/video-1.svg"}
                    alt={item.title}
                    width={800}
                    height={600}
                    className="w-full object-cover transition duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white transition hover:bg-black/40">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/20 backdrop-blur border border-white/40">
                      ▶
                    </div>
                  </div>
                </div>
              )}
              <div className="p-5">
                <p className="text-sm font-bold text-neutral-900">
                  {item.title}
                </p>
                <p className="mt-1 text-[0.65rem] uppercase tracking-[0.25em] text-neutral-400">
                  {item.type}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
