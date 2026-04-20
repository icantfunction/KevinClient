// Stage 3 Inbox List Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const unreadOnly = event.queryStringParameters?.unread === "true";
  const limitValue = event.queryStringParameters?.limit;
  const limit = limitValue ? Number(limitValue) : undefined;
  const { activitiesService, clientsService } = createStage3Services();

  const activities = await activitiesService.listInbox({
    unreadOnly,
    clientId: event.queryStringParameters?.client_id,
    scopeType: event.queryStringParameters?.scope_type,
    scopeId: event.queryStringParameters?.scope_id,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  const uniqueClientIds = Array.from(
    new Set(activities.map((activity: (typeof activities)[number]) => activity.clientId).filter(Boolean)),
  ) as string[];
  const clients = await Promise.all(uniqueClientIds.map((clientId: string) => clientsService.getClientById(clientId)));
  const clientMap = new Map(
    clients
      .filter((client): client is NonNullable<(typeof clients)[number]> => Boolean(client))
      .map((client) => [client.id, client]),
  );

  return jsonResponse(200, {
    activities: activities.map((activity: (typeof activities)[number]) => ({
      ...activity,
      client: activity.clientId ? clientMap.get(activity.clientId) ?? null : null,
    })),
  });
};
