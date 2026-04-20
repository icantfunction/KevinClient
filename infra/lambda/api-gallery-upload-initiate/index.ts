// Stage 6 Gallery Upload Initiate Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { initiateGalleryMultipartUpload } from "../shared/gallery-upload";
import { jsonResponse, parseJsonBody } from "../shared/http";

type InitiateUploadRequest = {
  readonly filename?: string;
  readonly contentType?: string;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const galleryId = event.pathParameters?.id;
  if (!galleryId) {
    return jsonResponse(400, { error: "gallery id is required." });
  }

  const payload = parseJsonBody<InitiateUploadRequest>(event);
  if (!payload.filename?.trim() || !payload.contentType?.trim()) {
    return jsonResponse(400, { error: "filename and contentType are required." });
  }

  const { galleriesService } = createStage3Services();
  const gallery = await galleriesService.getGalleryById(galleryId);
  if (!gallery) {
    return jsonResponse(404, { error: "gallery not found." });
  }

  const upload = await initiateGalleryMultipartUpload(gallery.id, payload.filename.trim(), payload.contentType.trim());
  return jsonResponse(200, upload);
};
