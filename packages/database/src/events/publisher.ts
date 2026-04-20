// Stage 2 Event Publisher Purpose
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { resolveDatabaseRuntimeConfig } from "../config";

export type DomainMutationEvent = {
  readonly entityName: string;
  readonly eventName: string;
  readonly entityId: string;
  readonly actor: string;
  readonly occurredAt: string;
  readonly before: Record<string, unknown> | null;
  readonly after: Record<string, unknown> | null;
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

export const publishDomainMutationEvent = async (event: DomainMutationEvent): Promise<void> => {
  const runtimeConfig = resolveDatabaseRuntimeConfig();
  const eventBridgeClient = createEventBridgeClient();

  const response = await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: runtimeConfig.eventBusName,
          Source: "studio-os.domain",
          DetailType: `${event.entityName}.${event.eventName}`,
          Time: new Date(event.occurredAt),
          Detail: JSON.stringify(event),
        },
      ],
    }),
  );

  if ((response.FailedEntryCount ?? 0) > 0) {
    throw new Error(`EventBridge publish failed for ${event.entityName}.${event.eventName}.`);
  }
};
