// Stage 7 Studio Bookings List Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { type StudioBookingStatus } from "@studio-os/database";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const status = event.queryStringParameters?.status as StudioBookingStatus | undefined;
  const clientId = event.queryStringParameters?.client_id;
  const spaceId = event.queryStringParameters?.space_id;
  const { studioBookingsService } = createStage3Services();
  const bookings = await studioBookingsService.listBookings({ status, clientId, spaceId });

  return jsonResponse(200, { bookings });
};
