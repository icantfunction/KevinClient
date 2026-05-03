export type Testimonial = {
  name: string;
  role: string;
  quote: string;
  videoUrl?: string;
};

export const testimonials: Testimonial[] = [
  {
    name: "Avery James",
    role: "Brand Founder",
    quote:
      "Booked on a week's notice and it was seamless. Lighting was perfect and the team was ready for us.",
  },
  {
    name: "Sasha Lee",
    role: "Event Host",
    quote:
      "Our shower felt elevated and intimate. The layout flexibility made the space feel custom.",
  },
  {
    name: "Jordan Patel",
    role: "Producer",
    quote:
      "Load-in was easy, Wi-Fi was fast, and we captured everything in one day. We'll be back.",
  },
];
