// Stage 4 Session Task Templates Purpose
import type { SessionType } from "../schema";

export type SessionTaskTemplate = {
  readonly title: string;
  readonly description: string;
  readonly offsetDays: number;
  readonly priority: "low" | "medium" | "high" | "urgent";
};

const genericTemplate = (sessionType: SessionType): SessionTaskTemplate[] => [
  {
    title: `Send ${sessionType} confirmation`,
    description: `Confirm logistics and expectations for the ${sessionType} session.`,
    offsetDays: -30,
    priority: "high",
  },
  {
    title: `Review ${sessionType} questionnaire`,
    description: `Make sure client details and preferences are complete.`,
    offsetDays: -14,
    priority: "medium",
  },
  {
    title: "Prepare gear and backups",
    description: "Check batteries, cards, lenses, lighting, and backup workflow.",
    offsetDays: -1,
    priority: "high",
  },
  {
    title: "Run day-of checklist",
    description: "Confirm travel time, contact info, and arrival plan.",
    offsetDays: 0,
    priority: "high",
  },
  {
    title: "Back up cards off-site",
    description: "Complete off-site backup immediately after the session.",
    offsetDays: 1,
    priority: "urgent",
  },
  {
    title: "Cull and shortlist images",
    description: "Review and narrow the working selection.",
    offsetDays: 3,
    priority: "high",
  },
  {
    title: "Edit final gallery",
    description: "Complete edits and prep for delivery.",
    offsetDays: 14,
    priority: "high",
  },
  {
    title: "Deliver gallery",
    description: "Publish the gallery and send delivery note to client.",
    offsetDays: 21,
    priority: "high",
  },
  {
    title: "Request review and testimonial",
    description: "Ask for feedback once delivery has settled.",
    offsetDays: 35,
    priority: "medium",
  },
  {
    title: "Archive session assets",
    description: "Move the project to archive and verify backups.",
    offsetDays: 90,
    priority: "low",
  },
];

const weddingTemplate: SessionTaskTemplate[] = [
  {
    title: "Send wedding welcome packet",
    description: "Send wedding planning info and expectations.",
    offsetDays: -60,
    priority: "high",
  },
  {
    title: "Confirm wedding timeline",
    description: "Lock the timeline with the couple before the event.",
    offsetDays: -21,
    priority: "high",
  },
  {
    title: "Confirm shot list and family formal groupings",
    description: "Finalize must-have combinations and logistics.",
    offsetDays: -14,
    priority: "high",
  },
  {
    title: "Confirm second shooter",
    description: "Verify coverage and call times with second shooter.",
    offsetDays: -7,
    priority: "high",
  },
  {
    title: "Check venue and weather",
    description: "Confirm venue access, lighting constraints, and weather risks.",
    offsetDays: -2,
    priority: "high",
  },
  ...genericTemplate("wedding"),
];

export const buildSessionTaskTemplates = (sessionType: SessionType): SessionTaskTemplate[] => {
  if (sessionType === "wedding") {
    return weddingTemplate;
  }

  return genericTemplate(sessionType);
};
