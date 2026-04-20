// Stage 6 Galleries Schema Purpose
import { bigint, index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns, requiredBoolean } from "./common";
import { sessions } from "./sessions";

export const galleryStatuses = ["processing", "ready", "delivered", "archived"] as const;

export type GalleryStatus = (typeof galleryStatuses)[number];
export type GalleryGpsCoords = { readonly lat?: number; readonly lng?: number };
export type GalleryAiTags = ReadonlyArray<Record<string, unknown>>;

export const galleries = pgTable(
  "galleries",
  {
    ...baseColumns,
    sessionId: uuid("session_id").references(() => sessions.id),
    slug: varchar("slug", { length: 160 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    coverPhotoId: uuid("cover_photo_id"),
    status: varchar("status", { length: 32 }).$type<GalleryStatus>().notNull().default("processing"),
    expectedPhotoCount: integer("expected_photo_count").notNull().default(0),
    processedPhotoCount: integer("processed_photo_count").notNull().default(0),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    downloadPin: varchar("download_pin", { length: 6 }),
    watermarkEnabled: requiredBoolean("watermark_enabled", false),
    aiTaggingEnabled: requiredBoolean("ai_tagging_enabled", false),
    clientCanFavorite: requiredBoolean("client_can_favorite", true),
    clientCanDownload: requiredBoolean("client_can_download", true),
    clientCanShare: requiredBoolean("client_can_share", true),
    printStoreEnabled: requiredBoolean("print_store_enabled", false),
    viewCount: integer("view_count").notNull().default(0),
    lastViewedAt: timestamp("last_viewed_at", { withTimezone: true }),
    uniqueVisitorCount: integer("unique_visitor_count").notNull().default(0),
  },
  (table) => ({
    slugIndex: index("galleries_slug_idx").on(table.slug),
    statusIndex: index("galleries_status_idx").on(table.status, table.createdAt),
    sessionIndex: index("galleries_session_idx").on(table.sessionId, table.createdAt),
  }),
);

export const photos = pgTable(
  "photos",
  {
    ...baseColumns,
    galleryId: uuid("gallery_id").references(() => galleries.id).notNull(),
    originalS3Key: text("original_s3_key").notNull(),
    webS3Key: text("web_s3_key").notNull(),
    thumbS3Key: text("thumb_s3_key").notNull(),
    watermarkedS3Key: text("watermarked_s3_key"),
    sourceFilename: text("source_filename"),
    contentType: text("content_type"),
    width: integer("width"),
    height: integer("height"),
    fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
    takenAt: timestamp("taken_at", { withTimezone: true }),
    cameraMake: text("camera_make"),
    cameraModel: text("camera_model"),
    lens: text("lens"),
    iso: integer("iso"),
    aperture: text("aperture"),
    shutterSpeed: text("shutter_speed"),
    focalLength: text("focal_length"),
    gpsCoords: jsonb("gps_coords").$type<GalleryGpsCoords>().notNull().default(sql`'{}'::jsonb`),
    colorLabels: text("color_labels").array().notNull().default(sql`'{}'::text[]`),
    rating: integer("rating"),
    hiddenFromClient: requiredBoolean("hidden_from_client", false),
    favoritedByClient: requiredBoolean("favorited_by_client", false),
    downloadCount: integer("download_count").notNull().default(0),
    aiTags: jsonb("ai_tags").$type<GalleryAiTags>().notNull().default(sql`'[]'::jsonb`),
  },
  (table) => ({
    galleryCreatedIndex: index("photos_gallery_created_idx").on(table.galleryId, table.createdAt),
    galleryTakenIndex: index("photos_gallery_taken_idx").on(table.galleryId, table.takenAt),
  }),
);
