export type Rate = {
  label: string;
  price: string;
  details: string;
};

export type AddOn = {
  item: string;
  price: string;
  notes: string;
};

export const rates: Rate[] = [
  {
    label: "Content Studio",
    price: "$95 / hour",
    details: "2-hour minimum. Ideal for photo/video shoots.",
  },
  {
    label: "Event Rental",
    price: "$165 / hour",
    details: "3-hour minimum. Includes tables + chairs.",
  },
  {
    label: "Full-Day Buyout",
    price: "$1,250 / 10 hours",
    details: "Best value for production days and full events.",
  },
];

export const rateNotes = [
  "50% deposit to reserve your date.",
  "Overtime billed in 30-minute increments.",
  "Cleaning fee required for events with food or alcohol.",
  "Holiday pricing available upon request.",
];

export const addOns: AddOn[] = [
  {
    item: "Lighting kit",
    price: "$65",
    notes: "Two LED panels + modifiers.",
  },
  {
    item: "Backdrop bundle",
    price: "$40",
    notes: "Choice of 3 seamless colors.",
  },
  {
    item: "On-site studio manager",
    price: "$55 / hour",
    notes: "Support for setup + transitions.",
  },
  {
    item: "Event attendant",
    price: "$45 / hour",
    notes: "Guest flow + reset support.",
  },
  {
    item: "Cleaning & reset",
    price: "$120",
    notes: "Required for events with food/drinks.",
  },
  {
    item: "Extra furniture set",
    price: "$75",
    notes: "Lounge seating + cocktail tables.",
  },
];
