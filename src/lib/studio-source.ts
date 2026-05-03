// Stage 10 Folded Studio Source Purpose
export const foldedStudioSource = {
  name: "Kevin's Creator Studio",
  strapline: "Production-ready rental space for photo, video, podcast, and intimate creator events.",
  description:
    "Folded from the local KevinStudio app into the main codebase so the studio story, rates, amenities, and booking language live beside Kevin's operating dashboard.",
  rates: [
    { label: "Content Studio", price: "$95 / hour", details: "2-hour minimum for photo and video production." },
    { label: "Event Rental", price: "$165 / hour", details: "3-hour minimum with tables, chairs, and reset buffer." },
    { label: "Full-Day Buyout", price: "$1,250 / 10 hours", details: "Best fit for branded shoots and multi-set days." },
  ],
  amenities: [
    "Natural-light shooting bay with 14 ft ceilings",
    "Prep and glam zone with vanity mirrors and steamer",
    "Backdrop wall with neutral and chroma options",
    "Grip equipment, power distribution, and fast Wi-Fi",
    "Kitchenette, furniture set, and on-site parking",
    "Sound-friendlier corners for podcast and talking-head capture",
  ],
  useCases: [
    {
      title: "Campaign and branded shoots",
      description: "Editorial stills, launch assets, and short-form video without piecing together multiple locations.",
    },
    {
      title: "Creator rental sessions",
      description: "Hourly bookings with add-on equipment, lighting assistance, and access-code entry windows.",
    },
    {
      title: "Podcast and workshop setups",
      description: "Intimate teaching sessions, interviews, and creator meetups in a controlled space.",
    },
  ],
  contact: {
    bookingEmail: "book@kevinscreatorstudio.com",
    inquiryEmail: "hello@kevinscreatorstudio.com",
    phone: "+1 (954) 854-1484",
    smsLine: "+1 (954) 854-1484",
    address: {
      street: "Studio address shared after booking",
      cityLine: "Coconut Creek, FL",
    },
    serviceArea: "Broward, Palm Beach, and Miami-Dade — South Florida.",
  },
  hours: [
    { day: "Mon – Fri", windows: ["8:00 AM – 9:00 PM"] },
    { day: "Saturday", windows: ["9:00 AM – 8:00 PM"] },
    { day: "Sunday", windows: ["By appointment"] },
  ],
  bookingNotes: [
    "All bookings include a 30-minute reset buffer at the start and end.",
    "A 25% deposit holds your slot. Balance due on the day of the shoot.",
    "Reschedules with 48 hours notice incur no fee.",
  ],
  faq: [
    {
      question: "Is parking included?",
      answer:
        "Yes — free on-site parking for up to 6 vehicles. Larger crews can use the lot across the street.",
    },
    {
      question: "Can I bring my own lighting and gear?",
      answer:
        "Absolutely. The space is C-stand and grip-friendly with plenty of power. House lighting is also available at no extra cost.",
    },
    {
      question: "Do you allow food, drinks, and pets?",
      answer:
        "Food and drinks are welcome — we'll show you the kitchenette. Pets are welcome for shoots; just let us know in advance so we can prep the space.",
    },
    {
      question: "What is your cancellation policy?",
      answer:
        "Reschedules made at least 48 hours before your booking are free. Cancellations inside 48 hours forfeit the deposit but credit toward a future booking within 90 days.",
    },
  ],
};
