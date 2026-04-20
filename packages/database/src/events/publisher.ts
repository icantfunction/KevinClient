// Stage 11.5 Event Publisher Purpose
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { resolveDatabaseRuntimeConfig } from "../config";
import type { OutboxDomainEventDetail } from "../services/event-outbox-service";

export type PendingOutboxEvent = {
  readonly id: string;
  readonly entityType: string;
  readonly entityId: string;
  readonly eventName: string;
  readonly detail: OutboxDomainEventDetail;
};

export type PublishedOutboxEventResult = {
  readonly id: string;
  readonly success: boolean;
  readonly errorMessage?: string;
};

let cachedEventBridgeClient: EventBridgeClient | undefined;

const createEventBridgeClient = (): EventBridgeClient => {
  if (!cachedEventBridgeClient) {
    const runtimeConfig = resolveDatabaseRuntimeConfig();
    cachedEventBridgeClient = new EventBridgeClient({
      region: runtimeConfig.region,
    });
  }

  return cachedEventBridgeClient;
};

const chunk = <TValue>(items: TValue[], size: number): TValue[][] => {
  const values: TValue[][] = [];
  for (let index = 0; index < items.length; index += size) {
    values.push(items.slice(index, index + size));
  }
  return values;
};

export const publishOutboxEvents = async (events: PendingOutboxEvent[]): Promise<PublishedOutboxEventResult[]> => {
  if (events.length === 0) {
    return [];
  }

  const runtimeConfig = resolveDatabaseRuntimeConfig();
  const eventBridgeClient = createEventBridgeClient();
  const results: PublishedOutboxEventResult[] = [];

  for (const batch of chunk(events, 10)) {
    try {
      const response = await eventBridgeClient.send(
        new PutEventsCommand({
          Entries: batch.map((event) => ({
            EventBusName: runtimeConfig.eventBusName,
            Source: "studio-os.domain",
            DetailType: `${event.entityType}.${event.eventName}`,
            Time: new Date(event.detail.occurredAt),
            Detail: JSON.stringify(event.detail),
            Resources: [event.entityId],
          })),
        }),
      );

      batch.forEach((event, index) => {
        const entry = response.Entries?.[index];
        if (entry?.ErrorCode || entry?.ErrorMessage) {
          results.push({
            id: event.id,
            success: false,
            errorMessage: `${entry.ErrorCode ?? "PutEventsError"}: ${entry.ErrorMessage ?? "unknown error"}`,
          });
          return;
        }

        results.push({
          id: event.id,
          success: true,
        });
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown EventBridge publish error.";
      batch.forEach((event) => {
        results.push({
          id: event.id,
          success: false,
          errorMessage,
        });
      });
    }
  }

  return results;
};
