// Stage 6 Gallery Upload Complete Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { completeGalleryMultipartUpload } from "../shared/gallery-upload";
import { jsonResponse, parseJsonBody } from "../shared/http";

type CompletedPart = {
  readonly ETag: string;
  readonly PartNumber: number;
};

type CompleteUploadRequest = {
  readonly objectKey?: string;
  readonly uploadId?: string;
  readonly parts?: CompletedPart[];
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const galleryId = event.pathParameters?.id;
  const photoId = event.pathParameters?.photoId;
  if (!galleryId || !photoId) {
    return jsonResponse(400, { error: "gallery id and photo id are required." });
  }

  const payload = parseJsonBody<CompleteUploadRequest>(event);
  if (!payload.objectKey || !payload.uploadId || !Array.isArray(payload.parts) || payload.parts.length === 0) {
    return jsonResponse(400, { error: "objectKey, uploadId, and parts are required." });
  }

  const result = await completeGalleryMultipartUpload(payload.objectKey, payload.uploadId, payload.parts);
  return jsonResponse(200, {
    completed: true,
    location: result.Location ?? null,
    objectKey: payload.objectKey,
  });
};
