// Stage 6 Public Gallery Get Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { verifyGalleryPublicToken } from "../shared/gallery-public-token";
import { createGalleryAssetSignedUrl } from "../shared/gallery-upload";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const token = event.pathParameters?.token;
  if (!token) {
    return jsonResponse(400, { error: "Gallery token is required." });
  }

  try {
    const { galleryId } = await verifyGalleryPublicToken(token);
    const { galleriesService, photosService } = createStage3Services();
    const gallery = await galleriesService.getGalleryById(galleryId);
    if (!gallery) {
      return jsonResponse(404, { error: "gallery not found." });
    }

    const photos = await photosService.listPhotosByGallery(gallery.id);
    const renderedPhotos = await Promise.all(
      photos.map(async (photo) => ({
        id: photo.id,
        width: photo.width,
        height: photo.height,
        thumbUrl: await createGalleryAssetSignedUrl(photo.thumbS3Key),
        webUrl: await createGalleryAssetSignedUrl(photo.watermarkedS3Key ?? photo.webS3Key),
        downloadUrl: gallery.clientCanDownload ? await createGalleryAssetSignedUrl(photo.webS3Key) : null,
        favoritedByClient: photo.favoritedByClient,
      })),
    );

    await galleriesService.recordView(gallery.id, {
      actor: "client:gallery",
      occurredAt: new Date(),
    });

    return jsonResponse(200, {
      gallery: {
        id: gallery.id,
        title: gallery.title,
        description: gallery.description,
        status: gallery.status,
        expiresAt: gallery.expiresAt,
        viewCount: gallery.viewCount + 1,
      },
      photos: renderedPhotos,
    });
  } catch (error) {
    return jsonResponse(401, { error: error instanceof Error ? error.message : "Invalid gallery token." });
  }
};
