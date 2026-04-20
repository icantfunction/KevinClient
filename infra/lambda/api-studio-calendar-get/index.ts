// Stage 7 Studio Calendar Get Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const from = event.queryStringParameters?.from ? new Date(event.queryStringParameters.from) : new Date();
  const to = event.queryStringParameters?.to
    ? new Date(event.queryStringParameters.to)
    : new Date(from.getTime() + 30 * 24 * 60 * 60 * 1000);
  const spaceId = event.queryStringParameters?.space_id;
  const { studioBookingsService } = createStage3Services();
  const entries = await studioBookingsService.listStudioCalendarEntries(from, to, spaceId);

  return jsonResponse(200, {
    from: from.toISOString(),
    to: to.toISOString(),
    spaceId: spaceId ?? null,
    entries,
  });
};
