export const siteConfig = {
  name: "World Wide Events",
  tagline: "Timeless events. Told worldwide.",
  description:
    "World Wide Events crafts editorial wedding photography for celebrations across Palm Beach, Miami, and worldwide.",
  email: "info@worldwidestudiospace.com",
  phone: "954-297-7638",
  phoneTel: "+19542977638",
  locations: ["Palm Beach", "Miami", "Worldwide travel"],
  navLinks: [
    { href: "/", label: "Home" },
    { href: "/galleries", label: "Galleries" },
    { href: "/info", label: "Info" },
    { href: "/contact", label: "Contact" },
  ] as const,
} as const;
