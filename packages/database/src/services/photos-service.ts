// Stage 6 Photos Service Purpose
import { and, asc, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { photos, type GalleryAiTags, type GalleryGpsCoords } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type UpsertProcessedPhotoInput = {
  readonly id?: string;
  readonly galleryId: string;
  readonly originalS3Key: string;
  readonly webS3Key: string;
  readonly thumbS3Key: string;
  readonly watermarkedS3Key?: string | null;
  readonly sourceFilename?: string | null;
  readonly contentType?: string | null;
  readonly width?: number | null;
  readonly height?: number | null;
  readonly fileSizeBytes?: number | null;
  readonly takenAt?: Date | null;
  readonly cameraMake?: string | null;
  readonly cameraModel?: string | null;
  readonly lens?: string | null;
  readonly iso?: number | null;
  readonly aperture?: string | null;
  readonly shutterSpeed?: string | null;
  readonly focalLength?: string | null;
  readonly gpsCoords?: GalleryGpsCoords;
  readonly colorLabels?: string[];
  readonly aiTags?: GalleryAiTags;
};

export class PhotosService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async getPhotoById(id: string) {
    const rows = await this.database
      .select()
      .from(photos)
      .where(and(eq(photos.id, id), isNull(photos.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }

  public async listPhotosByGallery(galleryId: string, includeHidden = false) {
    return this.database
      .select()
      .from(photos)
      .where(
        and(
          eq(photos.galleryId, galleryId),
          isNull(photos.deletedAt),
          includeHidden ? undefined : eq(photos.hiddenFromClient, false),
        ),
      )
      .orderBy(asc(photos.createdAt));
  }

  public async upsertProcessedPhoto(input: UpsertProcessedPhotoInput, context: MutationContext) {
    const existing = input.id ? await this.getPhotoById(input.id) : null;
    const occurredAt = context.occurredAt ?? new Date();
    const nextId = existing?.id ?? input.id ?? createUuid();

    const record = {
      id: nextId,
      galleryId: input.galleryId,
      originalS3Key: input.originalS3Key,
      webS3Key: input.webS3Key,
      thumbS3Key: input.thumbS3Key,
      watermarkedS3Key: input.watermarkedS3Key ?? null,
      sourceFilename: input.sourceFilename ?? null,
      contentType: input.contentType ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      fileSizeBytes: input.fileSizeBytes ?? null,
      takenAt: input.takenAt ?? null,
      cameraMake: input.cameraMake ?? null,
      cameraModel: input.cameraModel ?? null,
      lens: input.lens ?? null,
      iso: input.iso ?? null,
      aperture: input.aperture ?? null,
      shutterSpeed: input.shutterSpeed ?? null,
      focalLength: input.focalLength ?? null,
      gpsCoords: input.gpsCoords ?? {},
      colorLabels: input.colorLabels ?? [],
      rating: existing?.rating ?? null,
      hiddenFromClient: existing?.hiddenFromClient ?? false,
      favoritedByClient: existing?.favoritedByClient ?? false,
      downloadCount: existing?.downloadCount ?? 0,
      aiTags: input.aiTags ?? [],
      createdAt: existing?.createdAt ?? occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: (existing?.version ?? 0) + 1,
    };

    return this.persistMutation(context, async (database) => {
      if (existing) {
        await database
          .update(photos)
          .set({
            originalS3Key: record.originalS3Key,
            webS3Key: record.webS3Key,
            thumbS3Key: record.thumbS3Key,
            watermarkedS3Key: record.watermarkedS3Key,
            sourceFilename: record.sourceFilename,
            contentType: record.contentType,
            width: record.width,
            height: record.height,
            fileSizeBytes: record.fileSizeBytes,
            takenAt: record.takenAt,
            cameraMake: record.cameraMake,
            cameraModel: record.cameraModel,
            lens: record.lens,
            iso: record.iso,
            aperture: record.aperture,
            shutterSpeed: record.shutterSpeed,
            focalLength: record.focalLength,
            gpsCoords: record.gpsCoords,
            colorLabels: record.colorLabels,
            aiTags: record.aiTags,
            updatedAt: record.updatedAt,
            version: record.version,
          })
          .where(eq(photos.id, existing.id));
      } else {
        await database.insert(photos).values(record);
      }

      return {
        entityName: "photo",
        eventName: existing ? "updated" : "created",
        entityId: nextId,
        before: existing,
        after: record,
        result: record,
      };
    });
  }
}
