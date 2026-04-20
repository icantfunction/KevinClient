// Stage 11.5 SES Event Logger Lambda Purpose
import type { SQSBatchResponse, SQSEvent } from "aws-lambda";
import { createStage3Services } from "../shared/database";

type SnsEnvelope = {
  readonly Type?: string;
  readonly Message?: string;
  readonly MessageId?: string;
};

type SesMailTags = Record<string, string[]>;

type TimestampCarrier = {
  readonly timestamp?: string;
};

type SesEventPayload = {
  readonly eventType?: string;
  readonly mail?: {
    readonly messageId?: string;
    readonly timestamp?: string;
    readonly destination?: string[];
    readonly commonHeaders?: {
      readonly subject?: string;
    };
    readonly tags?: SesMailTags;
  };
  readonly delivery?: TimestampCarrier & Record<string, unknown>;
  readonly bounce?: TimestampCarrier & Record<string, unknown>;
  readonly complaint?: TimestampCarrier & Record<string, unknown>;
  readonly open?: TimestampCarrier & Record<string, unknown>;
  readonly click?: TimestampCarrier & Record<string, unknown>;
  readonly send?: TimestampCarrier & Record<string, unknown>;
};

const parseSnsEnvelope = (body: string) => JSON.parse(body) as SnsEnvelope;
const parseSesEvent = (message: string) => JSON.parse(message) as SesEventPayload;

const readTag = (tags: SesMailTags | undefined, key: string) => {
  const value = tags?.[key]?.[0];
  return value?.trim() || null;
};

const resolveOccurredAt = (event: SesEventPayload) => {
  const candidates = [
    event.open?.timestamp,
    event.click?.timestamp,
    event.bounce?.timestamp,
    event.complaint?.timestamp,
    event.delivery?.timestamp,
    event.send?.timestamp,
    event.mail?.timestamp,
  ].filter((value): value is string => typeof value === "string" && value.length > 0);

  return candidates.length > 0 ? new Date(candidates[0]) : new Date();
};

const buildMetadata = (event: SesEventPayload) => ({
  mail: event.mail ?? null,
  delivery: event.delivery ?? null,
  bounce: event.bounce ?? null,
  complaint: event.complaint ?? null,
  open: event.open ?? null,
  click: event.click ?? null,
  send: event.send ?? null,
});

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const { activitiesService } = createStage3Services();
  const failures: SQSBatchResponse["batchItemFailures"] = [];

  for (const record of event.Records) {
    try {
      const envelope = parseSnsEnvelope(record.body);
      if (!envelope.Message) {
        continue;
      }

      const sesEvent = parseSesEvent(envelope.Message);
      const messageId = sesEvent.mail?.messageId;
      const eventType = sesEvent.eventType?.toLowerCase() ?? "unknown";
      if (!messageId) {
        continue;
      }

      const externalMessageId = `ses-event:${eventType}:${messageId}:${envelope.MessageId ?? record.messageId}`;
      const existingActivity = await activitiesService.getActivityByExternalMessageId(externalMessageId);
      if (existingActivity) {
        continue;
      }

      const tags = sesEvent.mail?.tags;
      const clientId = readTag(tags, "clientId");
      const scopeType = readTag(tags, "scopeType") ?? "communication";
      const scopeId = readTag(tags, "scopeId");
      const subject = sesEvent.mail?.commonHeaders?.subject ?? `SES ${eventType}`;
      const occurredAt = resolveOccurredAt(sesEvent);

      await activitiesService.createActivity(
        {
          clientId,
          scopeType,
          scopeId,
          channel: "email",
          direction: eventType === "bounce" || eventType === "complaint" ? "inbound" : "system",
          activityType: `email.${eventType}`,
          subject,
          body: JSON.stringify({
            eventType,
            destination: sesEvent.mail?.destination ?? [],
          }),
          externalMessageId,
          occurredAt,
          metadata: {
            sesMessageId: messageId,
            originalExternalMessageId: readTag(tags, "externalMessageId"),
            originalActivityType: readTag(tags, "activityType"),
            ...buildMetadata(sesEvent),
          },
        },
        {
          actor: "system",
          occurredAt,
        },
      );
    } catch (error) {
      console.error("Failed to process SES event notification", error);
      failures.push({
        itemIdentifier: record.messageId,
      });
    }
  }

  return {
    batchItemFailures: failures,
  };
};
