// Stage 7 Studio Booking Get Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const bookingId = event.pathParameters?.id;
  if (!bookingId) {
    return jsonResponse(400, { error: "booking id is required." });
  }

  const { studioBookingsService } = createStage3Services();
  const booking = await studioBookingsService.getBookingById(bookingId);
  if (!booking) {
    return jsonResponse(404, { error: "booking not found." });
  }

  return jsonResponse(200, { booking });
};
