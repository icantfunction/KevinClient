export const siteConfig = {
  name: "Worldwide Studio Space",
  description:
    "A modern studio and event venue designed for creators, photo shoots, and intimate celebrations.",
  siteUrl: "https://worldwidestudiospace.com",
  contactEmail: "info@worldwidestudiospace.com",
  phone: "(555) 218-9090",
  addressLine: "Studio District, Your City, ST 00000",
  city: "Your City",
  state: "ST",
  region: "Your Metro Area",
  bookingUrl:
    process.env.HONEYBOOK_BOOKING_URL ??
    "https://booking.honeybook.com/placeholder",
  inquiryUrl:
    process.env.HONEYBOOK_INQUIRY_URL ??
    "https://forms.honeybook.com/placeholder",
  instagramUrl: "https://instagram.com/worldwidestudiospace",
} as const;

export const seoKeywords = [
  "studio rental",
  "content studio",
  "photo studio rental",
  "video studio",
  "event space rental",
  "creative studio",
  "venue rental",
  "production space",
  `${siteConfig.city} studio rental`,
  `${siteConfig.city} event space`,
];

export const bookingSteps = [
  {
    title: "Choose your date",
    description:
      "Select your preferred date and time in HoneyBook. We respond quickly for last-minute bookings.",
  },
  {
    title: "Confirm details",
    description:
      "Review the space rules, add-ons, and your setup needs. We will verify availability within 24 hours.",
  },
  {
    title: "Secure the booking",
    description:
      "Pay the deposit and sign the agreement. You will receive a confirmation and arrival guide.",
  },
  {
    title: "Create + celebrate",
    description:
      "Arrive, load in, and bring your vision to life. Our team is on-call for support.",
  },
];
