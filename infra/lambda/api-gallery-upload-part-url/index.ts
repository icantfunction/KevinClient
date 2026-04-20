// Stage 6 Gallery Upload Part URL Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { getGalleryUploadPartUrl } from "../shared/gallery-upload";
import { jsonResponse, parseJsonBody } from "../shared/http";

type UploadPartUrlRequest = {
  readonly objectKey?: string;
  readonly uploadId?: string;
  readonly partNumber?: number;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const galleryId = event.pathParameters?.id;
  const photoId = event.pathParameters?.photoId;
  if (!galleryId || !photoId) {
    return jsonResponse(400, { error: "gallery id and photo id are required." });
  }

  const payload = parseJsonBody<UploadPartUrlRequest>(event);
  if (!payload.objectKey || !payload.uploadId || !payload.partNumber) {
    return jsonResponse(400, { error: "objectKey, uploadId, and partNumber are required." });
  }

  const uploadUrl = await getGalleryUploadPartUrl(payload.objectKey, payload.uploadId, payload.partNumber);
  return jsonResponse(200, { uploadUrl });
};
