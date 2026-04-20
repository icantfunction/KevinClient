// Stage 7 Studio Equipment Create Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreateStudioEquipmentRequest = {
  readonly name?: string;
  readonly description?: string | null;
  readonly hourlyRateCents?: number;
  readonly dailyRateCents?: number;
  readonly replacementCostCents?: number;
  readonly quantityOwned?: number;
  readonly quantityAvailable?: number;
  readonly conditionNotes?: string | null;
  readonly lastServicedAt?: string | null;
  readonly images?: string[];
  readonly active?: boolean;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/studio/equipment:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateStudioEquipmentRequest>(event);
    if (!payload.name?.trim()) {
      return jsonResponse(400, { error: "name is required." });
    }

    const { equipmentService } = createStage3Services();
    const equipment = await equipmentService.createEquipment(
      {
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        hourlyRateCents: payload.hourlyRateCents,
        dailyRateCents: payload.dailyRateCents,
        replacementCostCents: payload.replacementCostCents,
        quantityOwned: payload.quantityOwned,
        quantityAvailable: payload.quantityAvailable,
        conditionNotes: payload.conditionNotes?.trim() || null,
        lastServicedAt: payload.lastServicedAt ? new Date(payload.lastServicedAt) : null,
        images: payload.images ?? [],
        active: payload.active ?? true,
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    const response = jsonResponse(201, { equipment });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
