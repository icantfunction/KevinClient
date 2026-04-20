// Stage 6 Database Smoke Script Purpose
import {
  ClientsService,
  GalleriesService,
  PhotosService,
  SessionsService,
  createDatabaseClient,
} from "../src/index";
import { applyStageEnvironment } from "./shared";

const run = async () => {
  await applyStageEnvironment();

  const database = createDatabaseClient();
  const actor = "system:stage-6-smoke";
  const occurredAt = new Date();
  const clientsService = new ClientsService(database);
  const sessionsService = new SessionsService(database);
  const galleriesService = new GalleriesService(database);
  const photosService = new PhotosService(database);

  const client = await clientsService.createClient(
    {
      clientType: "photo",
      primaryName: "Stage 6 Client",
      email: "stage6-client@example.com",
      phone: "+19545550006",
    },
    { actor, occurredAt },
  );

  const session = await sessionsService.createSession(
    {
      clientId: client.id,
      sessionType: "portrait",
      title: "Stage 6 Portrait Session",
      scheduledStart: new Date("2026-06-10T14:00:00.000Z"),
    },
    { actor, occurredAt },
  );

  const gallery = await galleriesService.createGallery(
    {
      sessionId: session.id,
      slug: `stage-6-gallery-${Date.now()}`,
      title: "Stage 6 Gallery",
      expectedPhotoCount: 1,
      watermarkEnabled: true,
    },
    { actor, occurredAt },
  );

  const photo = await photosService.upsertProcessedPhoto(
    {
      galleryId: gallery.id,
      originalS3Key: `galleries/${gallery.id}/originals/sample.jpg`,
      webS3Key: `galleries/${gallery.id}/web/sample.jpg`,
      thumbS3Key: `galleries/${gallery.id}/thumbs/sample.jpg`,
      watermarkedS3Key: `galleries/${gallery.id}/watermarked/sample.jpg`,
      sourceFilename: "sample.jpg",
      width: 1200,
      height: 800,
      fileSizeBytes: 128_000,
      cameraMake: "Canon",
      cameraModel: "R6",
      colorLabels: ["Warm"],
      aiTags: [{ name: "Person", confidence: 99.2 }],
    },
    { actor, occurredAt },
  );

  const readyGallery = await galleriesService.recordPhotoProcessed(gallery.id, { actor, occurredAt });

  console.log(
    JSON.stringify(
      {
        clientId: client.id,
        sessionId: session.id,
        galleryId: gallery.id,
        photoId: photo.id,
        galleryStatus: readyGallery.status,
        processedPhotoCount: readyGallery.processedPhotoCount,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
