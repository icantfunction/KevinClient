// Stage 4 Shot List Upsert Lambda Purpose
import type { ShotListItem } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse, parseJsonBody } from "../shared/http";

type ShotListRequest = {
  readonly items?: ShotListItem[];
  readonly notes?: string | null;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const sessionId = event.pathParameters?.id;
  if (!sessionId) {
    return jsonResponse(400, { error: "session id is required." });
  }

  const payload = parseJsonBody<ShotListRequest>(event);
  if (!Array.isArray(payload.items)) {
    return jsonResponse(400, { error: "items must be an array." });
  }

  const { activitiesService, sessionsService, shotListsService } = createStage3Services();
  const session = await sessionsService.getSessionById(sessionId);
  if (!session) {
    return jsonResponse(404, { error: "session not found." });
  }

  const occurredAt = new Date();
  const shotList = await shotListsService.upsertShotList(
    {
      sessionId,
      items: payload.items,
      notes: payload.notes ?? null,
    },
    { actor: "kevin", occurredAt },
  );

  if (!session.shotListId || session.shotListId !== shotList.id) {
    await sessionsService.attachShotList(sessionId, shotList.id, { actor: "kevin", occurredAt });
  }

  await activitiesService.createActivity(
    {
      clientId: session.clientId,
      scopeType: "shot_list",
      scopeId: shotList.id,
      channel: "system",
      direction: "internal",
      activityType: "shot_list.updated",
      subject: session.title,
      body: `Shot list updated for ${session.title}.`,
      occurredAt,
      metadata: {
        sessionId,
        itemCount: payload.items.length,
      },
    },
    { actor: "kevin", occurredAt },
  );

  return jsonResponse(200, { shotList });
};
