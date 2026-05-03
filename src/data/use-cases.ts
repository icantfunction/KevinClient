export type UseCase = {
  title: string;
  description: string;
  bullets: string[];
  cta: string;
  href: string;
};

export const useCases: UseCase[] = [
  {
    title: "Book for Content",
    description:
      "Designed for creators, teams, and agencies capturing photo, video, and podcast content.",
    bullets: [
      "Shoot-ready backdrops",
      "Lighting + grip add-ons",
      "Quiet zones for audio",
      "Fast Wi-Fi for live sessions",
    ],
    cta: "Explore content bookings",
    href: "/studio/content",
  },
  {
    title: "Book for Events",
    description:
      "A polished venue for showers, workshops, brand activations, and intimate celebrations.",
    bullets: [
      "Flexible seating layouts",
      "Preferred vendor list",
      "On-site coordinator options",
      "Easy access parking",
    ],
    cta: "Explore event bookings",
    href: "/studio/events",
  },
];
