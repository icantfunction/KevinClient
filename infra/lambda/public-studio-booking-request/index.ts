// Stage 7 Public Studio Booking Request Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type PublicStudioBookingRequest = {
  readonly name?: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly spaceId?: string | null;
  readonly bookingStart?: string | null;
  readonly bookingEnd?: string | null;
  readonly partySize?: number | null;
  readonly message?: string | null;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/studio/booking-request:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<PublicStudioBookingRequest>(event);
    if (!payload.name?.trim()) {
      return jsonResponse(400, { error: "name is required." });
    }

    const { inquiriesService, spacesService } = createStage3Services();
    const space = payload.spaceId ? await spacesService.getSpaceById(payload.spaceId) : null;
    const inquiry = await inquiriesService.createInquiry(
      {
        inquirerName: payload.name.trim(),
        email: payload.email?.trim() || null,
        phone: payload.phone?.trim() || null,
        eventType: "studio_rental",
        eventDate: payload.bookingStart ? new Date(payload.bookingStart) : null,
        eventLocation: space?.name ?? "Kevin Creator Studio",
        estimatedGuestCount: payload.partySize ?? null,
        message: payload.message?.trim() || null,
        metadata: {
          source: "studio_public_booking_page",
          spaceId: payload.spaceId ?? null,
          bookingStart: payload.bookingStart ?? null,
          bookingEnd: payload.bookingEnd ?? null,
          partySize: payload.partySize ?? null,
        },
      },
      { actor: "client:studio_request", occurredAt: new Date() },
    );

    const response = jsonResponse(201, { inquiry });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
