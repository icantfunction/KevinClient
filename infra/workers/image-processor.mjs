// Stage 6 Image Processor Worker Purpose
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { EventBridgeClient, PutEventsCommand } from "@aws-sdk/client-eventbridge";
import { DetectFacesCommand, DetectLabelsCommand, RekognitionClient } from "@aws-sdk/client-rekognition";
import { ExecuteStatementCommand, RDSDataClient } from "@aws-sdk/client-rds-data";
import { ChangeMessageVisibilityCommand, DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import exifr from "exifr";
import sharp from "sharp";

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

const queueUrl = required("STUDIO_OS_GALLERY_INGRESS_QUEUE_URL");
const originalsBucketName = required("STUDIO_OS_GALLERY_ORIGINALS_BUCKET_NAME");
const derivativesBucketName = required("STUDIO_OS_GALLERY_DERIVATIVES_BUCKET_NAME");
const databaseName = required("STUDIO_OS_DATABASE_NAME");
const resourceArn = required("STUDIO_OS_DATABASE_RESOURCE_ARN");
const secretArn = required("STUDIO_OS_DATABASE_SECRET_ARN");
const eventBusName = process.env.STUDIO_OS_EVENT_BUS_NAME ?? "default";

const sqsClient = new SQSClient({});
const s3Client = new S3Client({});
const eventBridgeClient = new EventBridgeClient({});
const rekognitionClient = new RekognitionClient({});
const rdsClient = new RDSDataClient({});

const nullParam = (name) => ({
  name,
  value: {
    isNull: true,
  },
});

const stringParam = (name, value, typeHint) =>
  value == null
    ? nullParam(name)
    : {
        name,
        value: {
          stringValue: value,
        },
        ...(typeHint ? { typeHint } : {}),
      };

const longParam = (name, value) =>
  value == null
    ? nullParam(name)
    : {
        name,
        value: {
          longValue: Number(value),
        },
      };

const runStatement = async (sql, parameters = []) =>
  rdsClient.send(
    new ExecuteStatementCommand({
      database: databaseName,
      resourceArn,
      secretArn,
      sql,
      parameters,
    }),
  );

const getGallerySettings = async (galleryId) => {
  const response = await runStatement(
    `
      select watermark_enabled, ai_tagging_enabled
      from galleries
      where id = cast(:gallery_id as uuid) and deleted_at is null
      limit 1
    `,
    [stringParam("gallery_id", galleryId, "UUID")],
  );

  const row = response.records?.[0];
  if (!row) {
    throw new Error(`Gallery ${galleryId} was not found.`);
  }

  return {
    watermarkEnabled: row[0]?.booleanValue ?? false,
    aiTaggingEnabled: row[1]?.booleanValue ?? false,
  };
};

const buildWatermarkSvg = (text, width, height) =>
  Buffer.from(
    `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>
        .mark { fill: rgba(255,255,255,0.55); font-size: ${Math.max(24, Math.round(width / 18))}px; font-family: Helvetica, Arial, sans-serif; letter-spacing: 2px; }
      </style>
      <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" class="mark">${text}</text>
    </svg>`,
  );

const detectAiTags = async (buffer) => {
  const [labels, faces] = await Promise.all([
    rekognitionClient.send(
      new DetectLabelsCommand({
        Image: { Bytes: buffer },
        MaxLabels: 10,
      }),
    ),
    rekognitionClient.send(
      new DetectFacesCommand({
        Image: { Bytes: buffer },
        Attributes: ["DEFAULT"],
      }),
    ),
  ]);

  return [
    ...(labels.Labels ?? []).map((label) => ({
      type: "label",
      name: label.Name,
      confidence: label.Confidence,
    })),
    ...(faces.FaceDetails ?? []).map((face, index) => ({
      type: "face",
      index,
      confidence: face.Confidence,
    })),
  ];
};

const persistPhoto = async ({
  photoId,
  galleryId,
  originalS3Key,
  webS3Key,
  thumbS3Key,
  watermarkedS3Key,
  sourceFilename,
  contentType,
  width,
  height,
  fileSizeBytes,
  exif,
  colorLabels,
  aiTags,
}) => {
  const now = new Date().toISOString();
  await runStatement(
    `
      insert into photos (
        id, created_at, updated_at, deleted_at, version, gallery_id, original_s3_key, web_s3_key, thumb_s3_key,
        watermarked_s3_key, source_filename, content_type, width, height, file_size_bytes, taken_at,
        camera_make, camera_model, lens, iso, aperture, shutter_speed, focal_length, gps_coords, color_labels,
        rating, hidden_from_client, favorited_by_client, download_count, ai_tags
      )
      values (
        cast(:id as uuid), cast(:created_at as timestamptz), cast(:updated_at as timestamptz), null, 1, cast(:gallery_id as uuid), :original_s3_key, :web_s3_key, :thumb_s3_key,
        :watermarked_s3_key, :source_filename, :content_type, :width, :height, :file_size_bytes, cast(:taken_at as timestamptz),
        :camera_make, :camera_model, :lens, :iso, :aperture, :shutter_speed, :focal_length, cast(:gps_coords as jsonb), cast(:color_labels as text[]),
        null, false, false, 0, cast(:ai_tags as jsonb)
      )
      on conflict (id) do update set
        updated_at = excluded.updated_at,
        version = photos.version + 1,
        gallery_id = excluded.gallery_id,
        original_s3_key = excluded.original_s3_key,
        web_s3_key = excluded.web_s3_key,
        thumb_s3_key = excluded.thumb_s3_key,
        watermarked_s3_key = excluded.watermarked_s3_key,
        source_filename = excluded.source_filename,
        content_type = excluded.content_type,
        width = excluded.width,
        height = excluded.height,
        file_size_bytes = excluded.file_size_bytes,
        taken_at = excluded.taken_at,
        camera_make = excluded.camera_make,
        camera_model = excluded.camera_model,
        lens = excluded.lens,
        iso = excluded.iso,
        aperture = excluded.aperture,
        shutter_speed = excluded.shutter_speed,
        focal_length = excluded.focal_length,
        gps_coords = excluded.gps_coords,
        color_labels = excluded.color_labels,
        ai_tags = excluded.ai_tags
    `,
    [
      stringParam("id", photoId, "UUID"),
      stringParam("created_at", now),
      stringParam("updated_at", now),
      stringParam("gallery_id", galleryId, "UUID"),
      stringParam("original_s3_key", originalS3Key),
      stringParam("web_s3_key", webS3Key),
      stringParam("thumb_s3_key", thumbS3Key),
      stringParam("watermarked_s3_key", watermarkedS3Key),
      stringParam("source_filename", sourceFilename),
      stringParam("content_type", contentType ?? "application/octet-stream"),
      longParam("width", width),
      longParam("height", height),
      longParam("file_size_bytes", fileSizeBytes),
      stringParam("taken_at", exif?.DateTimeOriginal?.toISOString?.() ?? now),
      stringParam("camera_make", exif?.Make),
      stringParam("camera_model", exif?.Model),
      stringParam("lens", exif?.LensModel),
      longParam("iso", exif?.ISO ? Number(exif.ISO) : null),
      stringParam("aperture", exif?.FNumber ? `${exif.FNumber}` : null),
      stringParam("shutter_speed", exif?.ExposureTime ? `${exif.ExposureTime}` : null),
      stringParam("focal_length", exif?.FocalLength ? `${exif.FocalLength}` : null),
      stringParam("gps_coords", JSON.stringify({ lat: exif?.latitude, lng: exif?.longitude }), "JSON"),
      stringParam("color_labels", `{${colorLabels.map((entry) => `"${entry}"`).join(",")}}`),
      stringParam("ai_tags", JSON.stringify(aiTags), "JSON"),
    ],
  );
};

const processMessage = async (message) => {
  const payload = JSON.parse(message.Body);
  const { galleryId, photoId, objectKey } = payload;
  if (!galleryId || !photoId || !objectKey) {
    return;
  }

  const settings = await getGallerySettings(galleryId);
  const [head, object] = await Promise.all([
    s3Client.send(
      new HeadObjectCommand({
        Bucket: originalsBucketName,
        Key: objectKey,
      }),
    ),
    s3Client.send(
      new GetObjectCommand({
        Bucket: originalsBucketName,
        Key: objectKey,
      }),
    ),
  ]);

  const originalBytes = Buffer.from(await object.Body.transformToByteArray());
  const sourceFilename = objectKey.split("/").pop() ?? `${photoId}.jpg`;
  const tempDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "studio-os-photo-"));
  const sourcePath = path.join(tempDirectory, sourceFilename);
  await fs.writeFile(sourcePath, originalBytes);

  const image = sharp(originalBytes, { failOn: "none" });
  const metadata = await image.metadata();
  const stats = await image.stats();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;

  const webBytes = await image
    .clone()
    .rotate()
    .resize({ width: 2048, withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  const thumbBytes = await image
    .clone()
    .rotate()
    .resize({ width: 400, withoutEnlargement: true })
    .jpeg({ quality: 80, mozjpeg: true })
    .toBuffer();
  const watermarkedBytes = settings.watermarkEnabled
    ? await image
        .clone()
        .rotate()
        .resize({ width: 2048, withoutEnlargement: true })
        .composite([
          {
            input: buildWatermarkSvg("Kevin Studio OS", width || 2048, height || 1365),
            gravity: "center",
          },
        ])
        .jpeg({ quality: 85, mozjpeg: true })
        .toBuffer()
    : null;

  const webS3Key = `galleries/${galleryId}/web/${photoId}.jpg`;
  const thumbS3Key = `galleries/${galleryId}/thumbs/${photoId}.jpg`;
  const watermarkedS3Key = settings.watermarkEnabled ? `galleries/${galleryId}/watermarked/${photoId}.jpg` : null;

  await Promise.all([
    s3Client.send(
      new PutObjectCommand({
        Bucket: derivativesBucketName,
        Key: webS3Key,
        Body: webBytes,
        ContentType: "image/jpeg",
        StorageClass: "INTELLIGENT_TIERING",
      }),
    ),
    s3Client.send(
      new PutObjectCommand({
        Bucket: derivativesBucketName,
        Key: thumbS3Key,
        Body: thumbBytes,
        ContentType: "image/jpeg",
        StorageClass: "INTELLIGENT_TIERING",
      }),
    ),
    watermarkedBytes && watermarkedS3Key
      ? s3Client.send(
          new PutObjectCommand({
            Bucket: derivativesBucketName,
            Key: watermarkedS3Key,
            Body: watermarkedBytes,
            ContentType: "image/jpeg",
            StorageClass: "INTELLIGENT_TIERING",
          }),
        )
      : Promise.resolve(),
  ]);

  const exif = await exifr.parse(sourcePath, {
    tiff: true,
    ifd0: true,
    exif: true,
    gps: true,
  });
  const aiTags = settings.aiTaggingEnabled ? await detectAiTags(webBytes) : [];
  const colorLabels = [`rgb(${Math.round(stats.dominant.r)},${Math.round(stats.dominant.g)},${Math.round(stats.dominant.b)})`];

  await persistPhoto({
    photoId,
    galleryId,
    originalS3Key: objectKey,
    webS3Key,
    thumbS3Key,
    watermarkedS3Key,
    sourceFilename,
    contentType: head.ContentType ?? "image/jpeg",
    width,
    height,
    fileSizeBytes: head.ContentLength ?? originalBytes.length,
    exif,
    colorLabels,
    aiTags,
  });

  await eventBridgeClient.send(
    new PutEventsCommand({
      Entries: [
        {
          EventBusName: eventBusName,
          Source: "studio-os.domain",
          DetailType: "photo.processed",
          Time: new Date(),
          Detail: JSON.stringify({
            galleryId,
            photoId,
            objectKey,
            webS3Key,
            thumbS3Key,
            watermarkedS3Key,
            rekognitionCostEstimateUsd: settings.aiTaggingEnabled ? 0.001 : 0,
          }),
        },
      ],
    }),
  );

  await fs.rm(tempDirectory, { recursive: true, force: true });
};

const main = async () => {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await sqsClient.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 1,
        WaitTimeSeconds: 20,
        VisibilityTimeout: 300,
      }),
    );

    const message = response.Messages?.[0];
    if (!message?.ReceiptHandle) {
      continue;
    }

    try {
      await sqsClient.send(
        new ChangeMessageVisibilityCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle,
          VisibilityTimeout: 300,
        }),
      );
      await processMessage(message);
      await sqsClient.send(
        new DeleteMessageCommand({
          QueueUrl: queueUrl,
          ReceiptHandle: message.ReceiptHandle,
        }),
      );
    } catch (error) {
      console.error("Image processor failed", error);
    }
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
