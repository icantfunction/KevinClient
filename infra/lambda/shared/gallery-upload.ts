// Stage 6 Gallery Upload Helpers Purpose
import { createUuid } from "@studio-os/database";
import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type CompletedPart = {
  readonly ETag: string;
  readonly PartNumber: number;
};

const s3Client = new S3Client({});

const requireOriginalsBucketName = () => {
  const originalsBucketName = process.env.STUDIO_OS_GALLERY_ORIGINALS_BUCKET_NAME;
  if (!originalsBucketName) {
    throw new Error("Missing required environment variable: STUDIO_OS_GALLERY_ORIGINALS_BUCKET_NAME");
  }

  return originalsBucketName;
};

const requireDerivativesBucketName = () => {
  const derivativesBucketName = process.env.STUDIO_OS_GALLERY_DERIVATIVES_BUCKET_NAME;
  if (!derivativesBucketName) {
    throw new Error("Missing required environment variable: STUDIO_OS_GALLERY_DERIVATIVES_BUCKET_NAME");
  }

  return derivativesBucketName;
};

const sanitizeFilename = (filename: string) => filename.replace(/[^a-zA-Z0-9._-]/g, "-");

export const initiateGalleryMultipartUpload = async (
  galleryId: string,
  filename: string,
  contentType: string,
) => {
  const originalsBucketName = requireOriginalsBucketName();
  const photoId = createUuid();
  const objectKey = `galleries/${galleryId}/incoming/${photoId}/${sanitizeFilename(filename)}`;
  const response = await s3Client.send(
    new CreateMultipartUploadCommand({
      Bucket: originalsBucketName,
      Key: objectKey,
      ContentType: contentType,
      StorageClass: "INTELLIGENT_TIERING",
    }),
  );

  if (!response.UploadId) {
    throw new Error("S3 did not return an upload id.");
  }

  return {
    photoId,
    objectKey,
    uploadId: response.UploadId,
  };
};

export const getGalleryUploadPartUrl = async (objectKey: string, uploadId: string, partNumber: number) =>
  getSignedUrl(
    s3Client,
    new UploadPartCommand({
      Bucket: requireOriginalsBucketName(),
      Key: objectKey,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: 15 * 60 },
  );

export const completeGalleryMultipartUpload = async (objectKey: string, uploadId: string, parts: CompletedPart[]) =>
  s3Client.send(
    new CompleteMultipartUploadCommand({
      Bucket: requireOriginalsBucketName(),
      Key: objectKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts
          .slice()
          .sort((left, right) => left.PartNumber - right.PartNumber)
          .map((part) => ({
            ETag: part.ETag,
            PartNumber: part.PartNumber,
          })),
      },
    }),
  );

export const createGalleryAssetSignedUrl = async (objectKey: string) =>
  getSignedUrl(
    s3Client,
    new GetObjectCommand({
      Bucket: requireDerivativesBucketName(),
      Key: objectKey,
    }),
    { expiresIn: 15 * 60 },
  );
