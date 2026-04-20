// Stage 7 Studio Booking Update Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { type StudioBookingStatus } from "@studio-os/database";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type UpdateStudioBookingRequest = {
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
  const bookingId = event.pathParameters?.id;
  if (!bookingId) {
    return jsonResponse(400, { error: "booking id is required." });
  }

  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `PATCH:/studio/bookings/${bookingId}:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<UpdateStudioBookingRequest>(event);
    const { studioBookingsService, tasksService, spacesService } = createStage3Services();
    const existing = await studioBookingsService.getBookingById(bookingId);
    if (!existing) {
      await abandonIdempotentRequest(idempotencyKey);
      return jsonResponse(404, { error: "booking not found." });
    }

    const booking = await studioBookingsService.updateBooking(
      bookingId,
      {
        clientId: payload.clientId,
        spaceId: payload.spaceId,
        status: payload.status,
        bookingStart: payload.bookingStart ? new Date(payload.bookingStart) : undefined,
        bookingEnd: payload.bookingEnd ? new Date(payload.bookingEnd) : undefined,
        equipmentItems: payload.equipmentItems
          ? payload.equipmentItems
              .filter((item): item is { readonly equipmentId: string; readonly quantity?: number } => Boolean(item.equipmentId))
              .map((item) => ({
                equipmentId: item.equipmentId,
                quantity: Math.max(item.quantity ?? 1, 1),
              }))
          : undefined,
        partySize: payload.partySize,
        purpose: payload.purpose?.trim() || null,
        needsCleanupCrew: payload.needsCleanupCrew,
        needsLightingAssist: payload.needsLightingAssist,
        pricingBreakdown: payload.pricingBreakdown,
        depositAmountCents: payload.depositAmountCents,
        depositPaid: payload.depositPaid,
        balanceDueAt: payload.balanceDueAt ? new Date(payload.balanceDueAt) : null,
        balancePaid: payload.balancePaid,
        liabilityWaiverId: payload.liabilityWaiverId ?? null,
        checkinAt: payload.checkinAt ? new Date(payload.checkinAt) : null,
        checkoutAt: payload.checkoutAt ? new Date(payload.checkoutAt) : null,
        damageNoted: payload.damageNoted,
        damageNotes: payload.damageNotes?.trim() || null,
        damageChargeCents: payload.damageChargeCents,
        reviewRating: payload.reviewRating ?? null,
        reviewText: payload.reviewText?.trim() || null,
        holdExpiresAt: payload.holdExpiresAt ? new Date(payload.holdExpiresAt) : null,
        notes: payload.notes?.trim() || null,
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    if (existing.status !== "completed" && booking.status === "completed") {
      const space = await spacesService.getSpaceById(booking.spaceId);
      await tasksService.createTask(
        {
          scope: "studio_booking",
          scopeId: booking.id,
          title: `Turnover: ${space?.name ?? "studio space"}`,
          description: "Sweep, reset props, check equipment, and restock after booking completion.",
          status: "todo",
          priority: "high",
          dueAt: booking.bookingEnd,
        },
        { actor: "system", occurredAt: new Date() },
      );
    }

    const response = jsonResponse(200, { booking });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
