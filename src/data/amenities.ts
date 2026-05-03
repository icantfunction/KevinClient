export type Amenity = {
  name: string;
  description: string;
};

export const amenities: Amenity[] = [
  {
    name: "Natural light studio",
    description: "14 ft ceilings with diffused windows.",
  },
  {
    name: "Prep + glam area",
    description: "Vanity mirrors, steamer, and styling station.",
  },
  {
    name: "Backdrops",
    description: "White, sand, charcoal, and chroma options.",
  },
  {
    name: "Grip equipment",
    description: "C-stands, sandbags, and extension cords.",
  },
  {
    name: "Wi-Fi + power",
    description: "High-speed internet and distributed outlets.",
  },
  {
    name: "Sound-friendly zones",
    description: "Soft materials to reduce echo.",
  },
  {
    name: "Kitchenette",
    description: "Prep counter, fridge, and water station.",
  },
  {
    name: "Parking",
    description: "On-site parking for 12 vehicles.",
  },
  {
    name: "Furniture",
    description: "Modular seating, tables, and accent pieces.",
  },
  {
    name: "Climate control",
    description: "Zoned heating and cooling.",
  },
];

export const floorplan = {
  totalSquareFeet: "2,400 sq ft",
  studioSquareFeet: "1,800 sq ft",
  ceilingHeight: "14 ft",
  capacityStanding: "80 guests",
  capacitySeated: "50 guests",
  layoutNotes: "Open studio with lounge, prep area, and staging zone.",
};
