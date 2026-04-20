// Stage 11.5 SES Outbound Helper Purpose
import { SESClient, SendEmailCommand, type MessageTag } from "@aws-sdk/client-ses";

const sesClient = new SESClient({});
const senderEmail = process.env.STUDIO_OS_SES_FROM_EMAIL?.trim();
const configurationSetName = process.env.STUDIO_OS_SES_CONFIGURATION_SET_NAME?.trim();

const normalizeTagValue = (value: string | null | undefined) => value?.trim() || undefined;

export type StudioEmailTagInput = {
  readonly clientId?: string | null;
  readonly scopeType?: string | null;
  readonly scopeId?: string | null;
  readonly activityType?: string | null;
  readonly externalMessageId?: string | null;
};

export type StudioEmailSendInput = {
  readonly recipientEmail: string;
  readonly subject: string;
  readonly textBody: string;
  readonly htmlBody?: string | null;
  readonly tags?: StudioEmailTagInput;
};

export type StudioEmailSendResult = {
  readonly deliveryStatus: "sent" | "skipped" | "failed";
  readonly deliveryError: string | null;
  readonly messageId: string | null;
  readonly senderConfigured: boolean;
  readonly configurationSetName: string | null;
};

const buildTags = (tags: StudioEmailTagInput | undefined): MessageTag[] | undefined => {
  if (!tags) {
    return undefined;
  }

  const resolved = [
    ["clientId", normalizeTagValue(tags.clientId)],
    ["scopeType", normalizeTagValue(tags.scopeType)],
    ["scopeId", normalizeTagValue(tags.scopeId)],
    ["activityType", normalizeTagValue(tags.activityType)],
    ["externalMessageId", normalizeTagValue(tags.externalMessageId)],
  ]
    .filter((entry): entry is [string, string] => Boolean(entry[1]))
    .map(([Name, Value]) => ({ Name, Value }));

  return resolved.length > 0 ? resolved : undefined;
};

export const sendStudioEmail = async (input: StudioEmailSendInput): Promise<StudioEmailSendResult> => {
  if (!senderEmail) {
    return {
      deliveryStatus: "skipped",
      deliveryError: "SES sender identity is not configured.",
      messageId: null,
      senderConfigured: false,
      configurationSetName: configurationSetName ?? null,
    };
  }

  try {
    const response = await sesClient.send(
      new SendEmailCommand({
        Source: senderEmail,
        Destination: {
          ToAddresses: [input.recipientEmail],
        },
        ReplyToAddresses: [senderEmail],
        ConfigurationSetName: configurationSetName || undefined,
        Tags: buildTags(input.tags),
        Message: {
          Subject: { Data: input.subject },
          Body: {
            Text: { Data: input.textBody },
            Html: input.htmlBody ? { Data: input.htmlBody } : undefined,
          },
        },
      }),
    );

    return {
      deliveryStatus: "sent",
      deliveryError: null,
      messageId: response.MessageId ?? null,
      senderConfigured: true,
      configurationSetName: configurationSetName ?? null,
    };
  } catch (error) {
    return {
      deliveryStatus: "failed",
      deliveryError: error instanceof Error ? error.message : "Unknown SES error.",
      messageId: null,
      senderConfigured: true,
      configurationSetName: configurationSetName ?? null,
    };
  }
};
