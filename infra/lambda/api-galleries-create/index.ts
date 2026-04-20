// Stage 6 Gallery Create Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreateGalleryRequest = {
  readonly sessionId?: string | null;
  readonly slug?: string;
  readonly title?: string;
  readonly description?: string | null;
  readonly expectedPhotoCount?: number;
  readonly expiresAt?: string | null;
  readonly downloadPin?: string | null;
  readonly watermarkEnabled?: boolean;
  readonly aiTaggingEnabled?: boolean;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/galleries:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateGalleryRequest>(event);
    if (!payload.slug?.trim() || !payload.title?.trim()) {
      return jsonResponse(400, { error: "slug and title are required." });
    }

    const { galleriesService } = createStage3Services();
    const gallery = await galleriesService.createGallery(
      {
        sessionId: payload.sessionId ?? null,
        slug: payload.slug.trim(),
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        expectedPhotoCount: Math.max(payload.expectedPhotoCount ?? 0, 0),
        expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : null,
        downloadPin: payload.downloadPin?.trim() || null,
        watermarkEnabled: payload.watermarkEnabled ?? false,
        aiTaggingEnabled: payload.aiTaggingEnabled ?? false,
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    const response = jsonResponse(201, { gallery });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
