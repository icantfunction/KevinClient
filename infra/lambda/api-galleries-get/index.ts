// Stage 6 Gallery Get Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const galleryId = event.pathParameters?.id;
  if (!galleryId) {
    return jsonResponse(400, { error: "gallery id is required." });
  }

  const { galleriesService, photosService } = createStage3Services();
  const gallery = await galleriesService.getGalleryById(galleryId);
  if (!gallery) {
    return jsonResponse(404, { error: "gallery not found." });
  }

  const photos = await photosService.listPhotosByGallery(gallery.id, true);
  return jsonResponse(200, { gallery, photos });
};
