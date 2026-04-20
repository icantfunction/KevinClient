// Stage 7 Studio Bookings Create Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { type StudioBookingStatus } from "@studio-os/database";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreateStudioBookingRequest = {
  readonly clientId?: string;
  readonly spaceId?: string;
  readonly status?: StudioBookingStatus;
  readonly bookingStart?: string;
  readonly bookingEnd?: string;
  readonly equipmentItems?: Array<{ readonly equipmentId?: string; readonly quantity?: number }>;
  readonly partySize?: number | null;
  readonly purpose?: string | null;
  readonly needsCleanupCrew?: boolean;
  readonly needsLightingAssist?: boolean;
  readonly pricingBreakdown?: Record<string, unknown>;
  readonly depositAmountCents?: number;
  readonly depositPaid?: boolean;
  readonly balanceDueAt?: string | null;
  readonly balancePaid?: boolean;
  readonly liabilityWaiverId?: string | null;
  readonly checkinAt?: string | null;
  readonly checkoutAt?: string | null;
  readonly damageNoted?: boolean;
  readonly damageNotes?: string | null;
  readonly damageChargeCents?: number;
  readonly reviewRating?: number | null;
  readonly reviewText?: string | null;
  readonly holdExpiresAt?: string | null;
  readonly notes?: string | null;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/studio/bookings:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateStudioBookingRequest>(event);
    if (!payload.clientId || !payload.spaceId || !payload.bookingStart || !payload.bookingEnd) {
      return jsonResponse(400, { error: "clientId, spaceId, bookingStart, and bookingEnd are required." });
    }

    const { studioBookingsService } = createStage3Services();
    const booking = await studioBookingsService.createBooking(
      {
        clientId: payload.clientId,
        spaceId: payload.spaceId,
        status: payload.status,
        bookingStart: new Date(payload.bookingStart),
        bookingEnd: new Date(payload.bookingEnd),
        equipmentItems: (payload.equipmentItems ?? [])
          .filter((item): item is { readonly equipmentId: string; readonly quantity?: number } => Boolean(item.equipmentId))
          .map((item) => ({
            equipmentId: item.equipmentId,
            quantity: Math.max(item.quantity ?? 1, 1),
          })),
        partySize: payload.partySize ?? null,
        purpose: payload.purpose?.trim() || null,
        needsCleanupCrew: payload.needsCleanupCrew ?? false,
        needsLightingAssist: payload.needsLightingAssist ?? false,
        pricingBreakdown: payload.pricingBreakdown ?? {},
        depositAmountCents: payload.depositAmountCents ?? 0,
        depositPaid: payload.depositPaid ?? false,
        balanceDueAt: payload.balanceDueAt ? new Date(payload.balanceDueAt) : null,
        balancePaid: payload.balancePaid ?? false,
        liabilityWaiverId: payload.liabilityWaiverId ?? null,
        checkinAt: payload.checkinAt ? new Date(payload.checkinAt) : null,
        checkoutAt: payload.checkoutAt ? new Date(payload.checkoutAt) : null,
        damageNoted: payload.damageNoted ?? false,
        damageNotes: payload.damageNotes?.trim() || null,
        damageChargeCents: payload.damageChargeCents ?? 0,
        reviewRating: payload.reviewRating ?? null,
        reviewText: payload.reviewText?.trim() || null,
        holdExpiresAt: payload.holdExpiresAt ? new Date(payload.holdExpiresAt) : null,
        notes: payload.notes?.trim() || null,
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    const response = jsonResponse(201, { booking });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
