// Stage 4 Calendar List Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const from = event.queryStringParameters?.from ? new Date(event.queryStringParameters.from) : new Date();
  const to = event.queryStringParameters?.to
    ? new Date(event.queryStringParameters.to)
    : new Date(from.getTime() + 60 * 24 * 60 * 60 * 1000);
  const { sessionsService } = createStage3Services();
  const entries = await sessionsService.listCalendarEntries(from, to);

  return jsonResponse(200, {
    from: from.toISOString(),
    to: to.toISOString(),
    entries,
  });
};
