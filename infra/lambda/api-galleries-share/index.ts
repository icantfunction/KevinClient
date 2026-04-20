// Stage 6 Gallery Share Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { issueGalleryPublicToken } from "../shared/gallery-public-token";
import { jsonResponse } from "../shared/http";

const apiUrl = process.env.STUDIO_OS_API_URL;

if (!apiUrl) {
  throw new Error("Missing required environment variable: STUDIO_OS_API_URL");
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  const galleryId = event.pathParameters?.id;
  if (!galleryId) {
    return jsonResponse(400, { error: "gallery id is required." });
  }

  const { galleriesService } = createStage3Services();
  const gallery = await galleriesService.getGalleryById(galleryId);
  if (!gallery) {
    return jsonResponse(404, { error: "gallery not found." });
  }

  const expiresAt = gallery.expiresAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const issued = await issueGalleryPublicToken(gallery.id, expiresAt);
  return jsonResponse(200, {
    galleryId: gallery.id,
    token: issued.token,
    galleryUrl: `${apiUrl}gallery/${encodeURIComponent(issued.token)}/page`,
    galleryApiUrl: `${apiUrl}gallery/${encodeURIComponent(issued.token)}`,
    expiresAt: issued.expiresAt.toISOString(),
  });
};
