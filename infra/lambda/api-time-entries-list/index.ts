// Stage 10 Time Entries List Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { type TimeEntryScope } from "@studio-os/database";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : undefined;
  const { timeEntriesService } = createStage3Services();
  const entries = await timeEntriesService.listTimeEntries({
    scope: event.queryStringParameters?.scope as TimeEntryScope | undefined,
    scopeId: event.queryStringParameters?.scope_id,
    activeOnly: event.queryStringParameters?.active_only === "true",
    from: event.queryStringParameters?.from ? new Date(event.queryStringParameters.from) : undefined,
    to: event.queryStringParameters?.to ? new Date(event.queryStringParameters.to) : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });
  const summary = await timeEntriesService.summarize(new Date());

  return jsonResponse(200, { entries, summary });
};
