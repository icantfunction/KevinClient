// Stage 6 Public Gallery Page Lambda Purpose
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { verifyGalleryPublicToken } from "../shared/gallery-public-token";
import { createGalleryAssetSignedUrl } from "../shared/gallery-upload";

const htmlResponse = (body: string): APIGatewayProxyStructuredResultV2 => ({
  statusCode: 200,
  headers: {
    "content-type": "text/html; charset=utf-8",
  },
  body,
});

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

export const handler = async (event: APIGatewayProxyEventV2) => {
  const token = event.pathParameters?.token;
  if (!token) {
    return htmlResponse("<h1>Gallery token is required.</h1>");
  }

  try {
    const { galleryId } = await verifyGalleryPublicToken(token);
    const { galleriesService, photosService } = createStage3Services();
    const gallery = await galleriesService.getGalleryById(galleryId);
    if (!gallery) {
      return {
        statusCode: 404,
        headers: { "content-type": "text/html; charset=utf-8" },
        body: "<h1>Gallery not found.</h1>",
      };
    }

    const photos = await photosService.listPhotosByGallery(gallery.id);
    const cards = await Promise.all(
      photos.map(async (photo) => {
        const webUrl = await createGalleryAssetSignedUrl(photo.watermarkedS3Key ?? photo.webS3Key);
        const thumbUrl = await createGalleryAssetSignedUrl(photo.thumbS3Key);
        return `
          <a class="card" href="${escapeHtml(webUrl)}" target="_blank" rel="noreferrer">
            <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(photo.sourceFilename ?? photo.id)}" loading="lazy" />
          </a>
        `;
      }),
    );

    await galleriesService.recordView(gallery.id, {
      actor: "client:gallery",
      occurredAt: new Date(),
    });

    return htmlResponse(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(gallery.title)}</title>
    <style>
      body { margin: 0; font-family: Georgia, serif; background: #f6f1eb; color: #1d1b18; }
      main { max-width: 1200px; margin: 0 auto; padding: 48px 24px 64px; }
      h1 { font-size: clamp(2rem, 4vw, 4rem); margin: 0 0 12px; }
      p { max-width: 720px; line-height: 1.6; }
      .status { margin: 0 0 32px; color: #6b5d4d; text-transform: uppercase; letter-spacing: 0.12em; font-size: 0.8rem; }
      .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); margin-top: 32px; }
      .card { display: block; background: white; border-radius: 18px; overflow: hidden; box-shadow: 0 16px 40px rgba(42, 30, 18, 0.08); }
      .card img { width: 100%; height: 240px; object-fit: cover; display: block; }
    </style>
  </head>
  <body>
    <main>
      <div class="status">${escapeHtml(gallery.status)}</div>
      <h1>${escapeHtml(gallery.title)}</h1>
      <p>${escapeHtml(gallery.description ?? "Gallery access provided by Kevin's Studio OS.")}</p>
      <section class="grid">
        ${cards.join("\n")}
      </section>
    </main>
  </body>
</html>`);
  } catch (error) {
    return {
      statusCode: 401,
      headers: { "content-type": "text/html; charset=utf-8" },
      body: `<h1>${escapeHtml(error instanceof Error ? error.message : "Invalid gallery token.")}</h1>`,
    };
  }
};
