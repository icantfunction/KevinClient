// Stage 9 Smart File Send Workflow Purpose
import type { ActivitiesService, SmartFilesService } from "@studio-os/database";
import { sendSmartFileEmail } from "./smart-file-email";
import { issueSmartFilePublicToken } from "./smart-file-public-token";

const apiUrl = process.env.STUDIO_OS_API_URL;

if (!apiUrl) {
  throw new Error("Missing required environment variable: STUDIO_OS_API_URL");
}

export const sendSmartFileWorkflow = async (input: {
  readonly smartFileId: string;
  readonly smartFilesService: SmartFilesService;
  readonly activitiesService: ActivitiesService;
  readonly actor: string;
  readonly occurredAt?: Date;
}) => {
  const smartFile = await input.smartFilesService.getSmartFileById(input.smartFileId);
  if (!smartFile) {
    throw new Error(`Smart file ${input.smartFileId} was not found.`);
  }

  const expiresAt = smartFile.expiresAt ?? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);
  const issued = await issueSmartFilePublicToken(smartFile.id, expiresAt);
  const signUrl = `${apiUrl}sign/${encodeURIComponent(issued.token)}/page`;
  const occurredAt = input.occurredAt ?? new Date();

  const updated = await input.smartFilesService.updateSmartFileStatus(
    smartFile.id,
    "sent",
    { actor: input.actor, occurredAt },
    {
      sentAt: occurredAt,
      lastPublicTokenAt: occurredAt,
      lastPublicTokenExpiresAt: issued.expiresAt,
    },
  );

  let deliveryStatus: "sent" | "skipped" | "failed" = "skipped";
  let deliveryError: string | null = null;

  if (smartFile.recipientEmail) {
    const delivery = await sendSmartFileEmail({
      recipientEmail: smartFile.recipientEmail,
      subject: smartFile.subject ?? `${smartFile.title} from Kevin`,
      textBody: [smartFile.message ?? "Kevin sent you a Smart File.", "", `Open: ${signUrl}`].join("\n"),
      htmlBody: [
        `<p>${smartFile.message ?? "Kevin sent you a Smart File."}</p>`,
        `<p><a href="${signUrl}">Open your Smart File</a></p>`,
      ].join(""),
      tags: {
        clientId: smartFile.clientId ?? null,
        scopeType: "smart_file",
        scopeId: smartFile.id,
        activityType: "smart_file.sent",
        externalMessageId: `smart-file-send:${smartFile.id}`,
      },
    });
    deliveryStatus = delivery.deliveryStatus;
    deliveryError = delivery.deliveryError;
  }

  await input.activitiesService.createActivity(
    {
      clientId: smartFile.clientId ?? null,
      scopeType: "smart_file",
      scopeId: smartFile.id,
      channel: "email",
      direction: "outbound",
      activityType: "smart_file.sent",
      subject: smartFile.subject ?? smartFile.title,
      body: smartFile.message ?? null,
      occurredAt,
      externalMessageId: `smart-file-send:${smartFile.id}:${occurredAt.toISOString()}`,
      metadata: {
        signUrl,
        deliveryStatus,
        deliveryError,
        configurationSetName: process.env.STUDIO_OS_SES_CONFIGURATION_SET_NAME ?? null,
      },
    },
    { actor: input.actor, occurredAt },
  );

  return {
    smartFile: updated,
    signUrl,
    deliveryStatus,
    deliveryError,
  };
};
