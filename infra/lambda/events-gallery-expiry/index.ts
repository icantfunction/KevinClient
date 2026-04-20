// Stage 9 Gallery Expiry Lambda Purpose
import { createStage3Services } from "../shared/database";
import { sendAutomationEmail } from "../shared/automation-notifications";

const millisecondsPerDay = 24 * 60 * 60 * 1000;

export const handler = async () => {
  const now = new Date();
  const {
    activitiesService,
    clientsService,
    galleriesService,
    sessionsService,
  } = createStage3Services();

  const galleries = await galleriesService.listGalleries();
  let expiryWarningsSent = 0;
  let reviewRequestsSent = 0;

  for (const gallery of galleries) {
    if (gallery.expiresAt) {
      const daysUntilExpiry = (gallery.expiresAt.getTime() - now.getTime()) / millisecondsPerDay;
      if (daysUntilExpiry >= 0 && daysUntilExpiry <= 7 && gallery.sessionId) {
        const session = await sessionsService.getSessionById(gallery.sessionId);
        const client = session ? await clientsService.getClientById(session.clientId) : null;
        if (client?.email) {
          const result = await sendAutomationEmail({
            services: { activitiesService },
            externalMessageId: `gallery:expiry-warning:${gallery.id}`,
            actor: "system",
            occurredAt: now,
            clientId: client.id,
            scopeType: "gallery",
            scopeId: gallery.id,
            activityType: "gallery.expiry_warning",
            recipientEmail: client.email,
            subject: `${gallery.title} expires soon`,
            body: [
              `Hi ${client.primaryName},`,
              "",
              `${gallery.title} is scheduled to expire on ${gallery.expiresAt.toISOString()}.`,
              "If you still need downloads or favorites, please review the gallery before it expires.",
              "",
              "Kevin's Studio OS",
            ].join("\n"),
          });

          if (!result.duplicate) {
            expiryWarningsSent += 1;
          }
        }
      }
    }

    if (gallery.deliveredAt && gallery.sessionId) {
      const daysSinceDelivery = (now.getTime() - gallery.deliveredAt.getTime()) / millisecondsPerDay;
      if (daysSinceDelivery >= 14 && daysSinceDelivery <= 21) {
        const session = await sessionsService.getSessionById(gallery.sessionId);
        const client = session ? await clientsService.getClientById(session.clientId) : null;
        if (client?.email) {
          const result = await sendAutomationEmail({
            services: { activitiesService },
            externalMessageId: `gallery:review-request:${gallery.id}`,
            actor: "system",
            occurredAt: now,
            clientId: client.id,
            scopeType: "gallery",
            scopeId: gallery.id,
            activityType: "gallery.review_request",
            recipientEmail: client.email,
            subject: `How did ${gallery.title} feel on your side?`,
            body: [
              `Hi ${client.primaryName},`,
              "",
              `Kevin hopes you are enjoying ${gallery.title}.`,
              "If you have a minute, reply with a review or testimonial Kevin can keep on file.",
              "",
              "Kevin's Studio OS",
            ].join("\n"),
          });

          if (!result.duplicate) {
            reviewRequestsSent += 1;
          }
        }
      }
    }
  }

  return {
    expiryWarningsSent,
    reviewRequestsSent,
  };
};
