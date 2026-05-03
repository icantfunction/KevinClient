export type Policy = {
  title: string;
  details: string;
};

export const policies: Policy[] = [
  {
    title: "Noise",
    details:
      "Quiet hours after 9 PM. DJ volume must stay within local ordinance limits.",
  },
  {
    title: "Alcohol",
    details:
      "Allowed with a licensed bartender for events with 30+ guests.",
  },
  {
    title: "Cleaning",
    details:
      "Spaces must be returned to original layout. Cleaning fee applies to food events.",
  },
  {
    title: "Overtime",
    details:
      "Overtime is billed at 1.5x hourly rate in 30-minute increments.",
  },
  {
    title: "Cancellation",
    details:
      "Cancellations within 14 days forfeit the deposit. Reschedules allowed once.",
  },
  {
    title: "Damage deposit",
    details:
      "A refundable $250 security hold is required for events.",
  },
];
