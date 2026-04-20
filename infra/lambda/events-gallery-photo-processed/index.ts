// Stage 6 Gallery Photo Processed Event Handler Purpose
import type { EventBridgeEvent } from "aws-lambda";
import { createStage3Services } from "../shared/database";

type PhotoProcessedDetail = {
  readonly galleryId?: string;
};

export const handler = async (event: EventBridgeEvent<string, PhotoProcessedDetail>) => {
  const galleryId = event.detail.galleryId;
  if (!galleryId) {
    return;
  }

  const { galleriesService } = createStage3Services();
  await galleriesService.recordPhotoProcessed(galleryId, {
    actor: "system",
    occurredAt: event.time ? new Date(event.time) : new Date(),
  });
};
