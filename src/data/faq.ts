export type Faq = {
  question: string;
  answer: string;
};

export const faqs: Faq[] = [
  {
    question: "How far in advance should I book?",
    answer:
      "We accept bookings up to 9 months out. Last-minute availability is common on weekdays.",
  },
  {
    question: "What is the minimum rental?",
    answer:
      "Content rentals start at 2 hours. Events start at 3 hours.",
  },
  {
    question: "Can I bring my own vendors?",
    answer:
      "Yes. Vendors must provide proof of insurance for events over 40 guests.",
  },
  {
    question: "Is furniture included?",
    answer:
      "Core lounge seating, tables, and chairs are included. Additional furniture is an add-on.",
  },
  {
    question: "Do you allow food and alcohol?",
    answer:
      "Food is welcome. Alcohol requires a licensed bartender for larger events.",
  },
  {
    question: "Is there a sound limit?",
    answer:
      "Yes. We support amplified sound but require volume monitoring after 9 PM.",
  },
];
