// Stage 3 Inquiry Auto Response Lambda Purpose
import type { EventBridgeEvent } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { sendStudioEmail } from "../shared/ses-outbound";

type InquiryCreatedDetail = {
  readonly entityId: string;
  readonly after: {
    readonly id: string;
    readonly inquirerName: string;
    readonly email: string | null;
    readonly phone: string | null;
    readonly eventType: string;
    readonly eventDate: string | null;
    readonly eventLocation: string | null;
  } | null;
};

const buildEmailBody = (inquiry: NonNullable<InquiryCreatedDetail["after"]>): string => {
  const lines = [
    `Hi ${inquiry.inquirerName},`,
    "",
    "Kevin received your inquiry and will follow up shortly.",
    `Type of project: ${inquiry.eventType}`,
    inquiry.eventLocation ? `Location: ${inquiry.eventLocation}` : null,
    inquiry.eventDate ? `Requested date: ${inquiry.eventDate}` : null,
    "",
    "This is an automated confirmation so you know your message came through.",
    "",
    "Kevin's Studio OS",
  ];

  return lines.filter(Boolean).join("\n");
};

export const handler = async (event: EventBridgeEvent<"inquiry.created", InquiryCreatedDetail>) => {
  const inquiry = event.detail.after;

  if (!inquiry) {
    return;
  }

  const { activitiesService, clientsService, tasksService } = createStage3Services();
  const sentinelMessageId = `inquiry-auto-response:${inquiry.id}`;
  const existingActivity = await activitiesService.getActivityByExternalMessageId(sentinelMessageId);

  if (existingActivity) {
    return;
  }

  const occurredAt = new Date();
  const matchedClient = await clientsService.findClientByContact(inquiry.email, inquiry.phone);
  const emailBody = buildEmailBody(inquiry);
  let deliveryStatus: "sent" | "skipped" | "failed" = "skipped";
  let deliveryError: string | null = null;
  let senderConfigured = true;
  let messageId: string | null = null;

  if (inquiry.email) {
    const delivery = await sendStudioEmail({
      recipientEmail: inquiry.email,
      subject: "Kevin got your inquiry",
      textBody: emailBody,
      htmlBody: `<p>${emailBody.replace(/\n/g, "<br/>")}</p>`,
      tags: {
        clientId: matchedClient?.id ?? null,
        scopeType: "inquiry",
        scopeId: inquiry.id,
        activityType: "inquiry.auto_response",
        externalMessageId: sentinelMessageId,
      },
    });
    deliveryStatus = delivery.deliveryStatus;
    deliveryError = delivery.deliveryError;
    senderConfigured = delivery.senderConfigured;
    messageId = delivery.messageId;
  }

  await activitiesService.createActivity(
    {
      clientId: matchedClient?.id ?? null,
      scopeType: "inquiry",
      scopeId: inquiry.id,
      channel: "email",
      direction: "outbound",
      activityType: "inquiry.auto_response",
      subject: "Kevin got your inquiry",
      body: emailBody,
      externalMessageId: sentinelMessageId,
      occurredAt,
      metadata: {
        deliveryStatus,
        deliveryError,
        senderConfigured,
        sesMessageId: messageId,
        configurationSetName: process.env.STUDIO_OS_SES_CONFIGURATION_SET_NAME ?? null,
      },
    },
    {
      actor: "system",
      occurredAt,
    },
  );

  await tasksService.createTask(
    {
      scope: "admin",
      title: `Follow up with ${inquiry.inquirerName}`,
      description: `Reply to inquiry ${inquiry.id} within 2 days.`,
      dueAt: new Date(occurredAt.getTime() + 2 * 24 * 60 * 60 * 1000),
      priority: "high",
      notes: inquiry.email ?? inquiry.phone ?? null,
    },
    {
      actor: "system",
      occurredAt,
    },
  );
};
