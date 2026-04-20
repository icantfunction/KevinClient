// Stage 8 Receipt Upload Helpers Purpose
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const s3Client = new S3Client({});

const requireReceiptBucketName = () => {
  const bucketName = process.env.STUDIO_OS_EXPENSE_RECEIPTS_BUCKET_NAME;
  if (!bucketName) {
    throw new Error("Missing required environment variable: STUDIO_OS_EXPENSE_RECEIPTS_BUCKET_NAME");
  }

  return bucketName;
};

const sanitizeFilename = (filename: string) => filename.replace(/[^a-zA-Z0-9._-]/g, "-");

export const buildReceiptObjectKey = (scanId: string, filename: string) =>
  `receipts/${scanId}/${sanitizeFilename(filename)}`;

export const createReceiptUploadUrl = async (objectKey: string, contentType: string) => {
  const bucketName = requireReceiptBucketName();
  const uploadUrl = await getSignedUrl(
    s3Client,
    new PutObjectCommand({
      Bucket: bucketName,
      Key: objectKey,
      ContentType: contentType,
      StorageClass: "INTELLIGENT_TIERING",
    }),
    {
      expiresIn: 15 * 60,
    },
  );

  return {
    bucketName,
    objectKey,
    uploadUrl,
  };
};
