// Stage 6 Gallery Ingest Router Lambda Purpose
import { createHash } from "node:crypto";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { S3Event } from "aws-lambda";

const queueUrl = process.env.STUDIO_OS_GALLERY_INGRESS_QUEUE_URL;
const sqsClient = new SQSClient({});

if (!queueUrl) {
  throw new Error("Missing required environment variable: STUDIO_OS_GALLERY_INGRESS_QUEUE_URL");
}

const extractParts = (objectKey: string) => {
  const segments = objectKey.split("/");
  if (segments.length < 5 || segments[0] !== "galleries") {
    return null;
  }

  return {
    galleryId: segments[1],
    photoId: segments[3],
    objectKey,
  };
};

export const handler = async (event: S3Event) => {
  for (const record of event.Records ?? []) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const parts = extractParts(objectKey);
    if (!parts) {
      continue;
    }

    const deduplicationId = createHash("sha256")
      .update(`${parts.objectKey}:${record.s3.object.eTag ?? record.eventTime}`)
      .digest("hex");

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageGroupId: parts.galleryId,
        MessageDeduplicationId: deduplicationId,
        MessageBody: JSON.stringify({
          bucketName,
          objectKey: parts.objectKey,
          galleryId: parts.galleryId,
          photoId: parts.photoId,
        }),
      }),
    );
  }
};
