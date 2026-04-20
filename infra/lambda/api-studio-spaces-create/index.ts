// Stage 7 Studio Spaces Create Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreateStudioSpaceRequest = {
  readonly name?: string;
  readonly description?: string | null;
  readonly capacity?: number;
  readonly hourlyRateCents?: number;
  readonly halfDayRateCents?: number;
  readonly fullDayRateCents?: number;
  readonly minBookingHours?: number;
  readonly bufferMinutes?: number;
  readonly amenities?: string[];
  readonly includedEquipment?: string[];
  readonly houseRules?: string | null;
  readonly coverImageS3Key?: string | null;
  readonly galleryImageS3Keys?: string[];
  readonly availabilityRules?: Record<string, unknown>;
  readonly active?: boolean;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/studio/spaces:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateStudioSpaceRequest>(event);
    if (!payload.name?.trim()) {
      return jsonResponse(400, { error: "name is required." });
    }

    const { spacesService } = createStage3Services();
    const space = await spacesService.createSpace(
      {
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        capacity: payload.capacity,
        hourlyRateCents: payload.hourlyRateCents,
        halfDayRateCents: payload.halfDayRateCents,
        fullDayRateCents: payload.fullDayRateCents,
        minBookingHours: payload.minBookingHours,
        bufferMinutes: payload.bufferMinutes,
        amenities: payload.amenities ?? [],
        includedEquipment: payload.includedEquipment ?? [],
        houseRules: payload.houseRules?.trim() || null,
        coverImageS3Key: payload.coverImageS3Key?.trim() || null,
        galleryImageS3Keys: payload.galleryImageS3Keys ?? [],
        availabilityRules: payload.availabilityRules ?? {},
        active: payload.active ?? true,
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    const response = jsonResponse(201, { space });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
