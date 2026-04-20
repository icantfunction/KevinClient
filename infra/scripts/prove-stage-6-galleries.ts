// Stage 6 Gallery Proof Script Purpose
import { randomUUID } from "node:crypto";
import {
  CloudFormationClient,
  DescribeStacksCommand,
  ListStackResourcesCommand,
  type Output,
  type StackResourceSummary,
} from "@aws-sdk/client-cloudformation";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";
import { GalleriesService, PhotosService, createDatabaseClient } from "@studio-os/database";
import { applyStageEnvironment } from "../../packages/database/scripts/shared";

type StackOutputs = Record<string, string>;

type LambdaHttpResponse<TBody extends Record<string, unknown>> = {
  readonly statusCode: number;
  readonly body: TBody;
};

type GalleryRecord = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly processedPhotoCount: number;
  readonly expectedPhotoCount: number;
  readonly viewCount: number;
};

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const apiStackName = "studio-os-stage-1-api";
const mediaStackName = "studio-os-stage-1-media";
const proofPhotoCount = Number.parseInt(process.env.STUDIO_OS_STAGE6_PHOTO_COUNT ?? "500", 10);
const uploadConcurrency = Number.parseInt(process.env.STUDIO_OS_STAGE6_UPLOAD_CONCURRENCY ?? "24", 10);
const readyTimeoutMs = Number.parseInt(process.env.STUDIO_OS_STAGE6_READY_TIMEOUT_MS ?? "1800000", 10);
const cloudFormation = new CloudFormationClient({ region });
const lambda = new LambdaClient({ region });
const sqs = new SQSClient({ region });

const samplePngBytes = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WnSUs0AAAAASUVORK5CYII=",
  "base64",
);

const requireOutput = (outputs: StackOutputs, key: string) => {
  const value = outputs[key];
  if (!value) {
    throw new Error(`Missing CloudFormation output ${key}.`);
  }

  return value;
};

const isStackOutput = (output: Output): output is Output & { OutputKey: string; OutputValue: string } =>
  Boolean(output.OutputKey && output.OutputValue);

const isStackResource = (resource: StackResourceSummary): resource is StackResourceSummary & {
  LogicalResourceId: string;
  PhysicalResourceId: string;
} => Boolean(resource.LogicalResourceId && resource.PhysicalResourceId);

const loadOutputs = async (stackName: string): Promise<StackOutputs> => {
  const response = await cloudFormation.send(
    new DescribeStacksCommand({
      StackName: stackName,
    }),
  );

  return Object.fromEntries(
    (response.Stacks?.[0]?.Outputs ?? [])
      .filter(isStackOutput)
      .map((output) => [output.OutputKey, output.OutputValue]),
  );
};

const loadStackResources = async (stackName: string) => {
  const resources: StackResourceSummary[] = [];
  let nextToken: string | undefined;

  do {
    const response = await cloudFormation.send(
      new ListStackResourcesCommand({
        StackName: stackName,
        NextToken: nextToken,
      }),
    );
    resources.push(...(response.StackResourceSummaries ?? []));
    nextToken = response.NextToken;
  } while (nextToken);

  return Object.fromEntries(
    resources
      .filter(isStackResource)
      .map((resource) => [resource.LogicalResourceId, resource.PhysicalResourceId]),
  );
};

const requireFunctionName = (resources: Record<string, string>, logicalIdPrefix: string) => {
  const match = Object.entries(resources).find(([logicalId]) => logicalId.startsWith(logicalIdPrefix));
  if (!match) {
    throw new Error(`Missing Lambda function with logical id prefix ${logicalIdPrefix}.`);
  }

  return match[1];
};

const requireResourceId = (resources: Record<string, string>, logicalIdPrefix: string) => {
  const match = Object.entries(resources).find(([logicalId]) => logicalId.startsWith(logicalIdPrefix));
  if (!match) {
    throw new Error(`Missing resource with logical id prefix ${logicalIdPrefix}.`);
  }

  return match[1];
};

const invokeHttpLambda = async <TBody extends Record<string, unknown>>(
  functionName: string,
  event: Record<string, unknown>,
): Promise<LambdaHttpResponse<TBody>> => {
  const response = await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(event)),
    }),
  );

  if (!response.Payload) {
    throw new Error(`Lambda ${functionName} returned an empty payload.`);
  }

  const rawPayload = Buffer.from(response.Payload).toString("utf8");
  if (response.FunctionError) {
    throw new Error(`Lambda ${functionName} failed: ${rawPayload}`);
  }

  const parsed = JSON.parse(rawPayload) as { statusCode?: number; body?: string };
  return {
    statusCode: parsed.statusCode ?? 500,
    body: parsed.body ? (JSON.parse(parsed.body) as TBody) : ({} as TBody),
  };
};

const withAuroraResumeRetry = async <T>(operation: () => Promise<T>, attempts = 4): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : `${error}`;
      if (!message.includes("DatabaseResumingException") || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Aurora resume retry exhausted.");
};

const getQueueCounts = async (queueUrl: string) => {
  const response = await sqs.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ["ApproximateNumberOfMessages", "ApproximateNumberOfMessagesNotVisible"],
    }),
  );

  return {
    visible: Number.parseInt(response.Attributes?.ApproximateNumberOfMessages ?? "0", 10),
    notVisible: Number.parseInt(response.Attributes?.ApproximateNumberOfMessagesNotVisible ?? "0", 10),
  };
};

const uploadOnePhoto = async (
  index: number,
  galleryId: string,
  initiateUploadFunctionName: string,
  getPartUrlFunctionName: string,
  completeUploadFunctionName: string,
) => {
  const initiateResponse = await invokeHttpLambda<{
    photoId?: string;
    objectKey?: string;
    uploadId?: string;
  }>(initiateUploadFunctionName, {
    pathParameters: {
      id: galleryId,
    },
    body: JSON.stringify({
      filename: `stage-6-proof-${index.toString().padStart(4, "0")}.png`,
      contentType: "image/png",
    }),
  });

  if (
    initiateResponse.statusCode !== 200 ||
    !initiateResponse.body.photoId ||
    !initiateResponse.body.objectKey ||
    !initiateResponse.body.uploadId
  ) {
    throw new Error(`Upload initiation failed for photo ${index}: ${JSON.stringify(initiateResponse)}`);
  }

  const { photoId, objectKey, uploadId } = initiateResponse.body;
  const partUrlResponse = await invokeHttpLambda<{ uploadUrl?: string }>(getPartUrlFunctionName, {
    pathParameters: {
      id: galleryId,
      photoId,
    },
    body: JSON.stringify({
      objectKey,
      uploadId,
      partNumber: 1,
    }),
  });

  if (partUrlResponse.statusCode !== 200 || !partUrlResponse.body.uploadUrl) {
    throw new Error(`Upload-part URL failed for photo ${index}: ${JSON.stringify(partUrlResponse)}`);
  }

  const uploadResponse = await fetch(partUrlResponse.body.uploadUrl, {
    method: "PUT",
    body: samplePngBytes,
    headers: {
      "content-type": "image/png",
    },
  });

  if (!uploadResponse.ok) {
    throw new Error(`S3 upload failed for photo ${index} with status ${uploadResponse.status}.`);
  }

  const etag = uploadResponse.headers.get("etag");
  if (!etag) {
    throw new Error(`S3 upload for photo ${index} did not return an ETag.`);
  }

  const completeResponse = await invokeHttpLambda<{ completed?: boolean }>(completeUploadFunctionName, {
    pathParameters: {
      id: galleryId,
      photoId,
    },
    body: JSON.stringify({
      objectKey,
      uploadId,
      parts: [{ ETag: etag, PartNumber: 1 }],
    }),
  });

  if (completeResponse.statusCode !== 200 || completeResponse.body.completed !== true) {
    throw new Error(`Multipart completion failed for photo ${index}: ${JSON.stringify(completeResponse)}`);
  }

  return {
    photoId,
    objectKey,
  };
};

const runWithConcurrency = async <TItem, TResult>(
  items: readonly TItem[],
  concurrency: number,
  worker: (item: TItem, index: number) => Promise<TResult>,
) => {
  const results = new Array<TResult>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const currentIndex = cursor;
      cursor += 1;
      if (currentIndex >= items.length) {
        return;
      }

      results[currentIndex] = await worker(items[currentIndex], currentIndex);
    }
  });

  await Promise.all(runners);
  return results;
};

const waitForGalleryReady = async (galleriesService: GalleriesService, galleryId: string) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < readyTimeoutMs) {
    const gallery = (await withAuroraResumeRetry(() => galleriesService.getGalleryById(galleryId))) as GalleryRecord | null;
    if (gallery?.status === "ready" && gallery.processedPhotoCount >= gallery.expectedPhotoCount) {
      return gallery;
    }

    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  throw new Error(`Timed out waiting for gallery ${galleryId} to become ready.`);
};

const main = async () => {
  if (!Number.isFinite(proofPhotoCount) || proofPhotoCount <= 0) {
    throw new Error("STUDIO_OS_STAGE6_PHOTO_COUNT must be a positive integer.");
  }

  if (!Number.isFinite(uploadConcurrency) || uploadConcurrency <= 0) {
    throw new Error("STUDIO_OS_STAGE6_UPLOAD_CONCURRENCY must be a positive integer.");
  }

  await applyStageEnvironment();

  const [apiOutputs, apiResources, mediaResources] = await Promise.all([
    loadOutputs(apiStackName),
    loadStackResources(apiStackName),
    loadStackResources(mediaStackName),
  ]);

  const createGalleryFunctionName = requireFunctionName(apiResources, "CreateGalleryFunction");
  const getGalleryFunctionName = requireFunctionName(apiResources, "GetGalleryFunction");
  const shareGalleryFunctionName = requireFunctionName(apiResources, "ShareGalleryFunction");
  const initiateUploadFunctionName = requireFunctionName(apiResources, "InitiateGalleryUploadFunction");
  const getPartUrlFunctionName = requireFunctionName(apiResources, "GetGalleryUploadPartUrlFunction");
  const completeUploadFunctionName = requireFunctionName(apiResources, "CompleteGalleryUploadFunction");
  const galleryIngressQueueUrl = requireResourceId(mediaResources, "GalleryIngressQueue");
  const galleryIngressDlqUrl = requireResourceId(mediaResources, "GalleryIngressDlq");

  const database = createDatabaseClient();
  const galleriesService = new GalleriesService(database);
  const photosService = new PhotosService(database);

  const startedAt = Date.now();
  const createResponse = await invokeHttpLambda<{ gallery?: { id: string } }>(createGalleryFunctionName, {
    headers: {
      "Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({
      slug: `stage-6-proof-${Date.now()}`,
      title: `Stage 6 Proof Gallery ${new Date().toISOString()}`,
      description: `Wedding-scale proof gallery with ${proofPhotoCount} direct S3 uploads.`,
      expectedPhotoCount: proofPhotoCount,
      watermarkEnabled: false,
      aiTaggingEnabled: false,
      clientCanDownload: true,
    }),
  });

  const galleryId = createResponse.body.gallery?.id;
  if (createResponse.statusCode !== 201 || !galleryId) {
    throw new Error(`Gallery creation failed: ${JSON.stringify(createResponse)}`);
  }

  const uploadStartedAt = Date.now();
  await runWithConcurrency(
    Array.from({ length: proofPhotoCount }, (_, index) => index),
    uploadConcurrency,
    async (index) =>
      uploadOnePhoto(index, galleryId, initiateUploadFunctionName, getPartUrlFunctionName, completeUploadFunctionName),
  );
  const uploadCompletedAt = Date.now();

  const readyGallery = await waitForGalleryReady(galleriesService, galleryId);
  const proofGetResponse = await invokeHttpLambda<{ gallery?: GalleryRecord; photos?: unknown[] }>(getGalleryFunctionName, {
    pathParameters: {
      id: galleryId,
    },
  });

  if (proofGetResponse.statusCode !== 200) {
    throw new Error(`Gallery fetch failed after processing: ${JSON.stringify(proofGetResponse)}`);
  }

  const shareResponse = await invokeHttpLambda<{
    galleryUrl?: string;
    galleryApiUrl?: string;
  }>(shareGalleryFunctionName, {
    pathParameters: {
      id: galleryId,
    },
  });

  if (shareResponse.statusCode !== 200 || !shareResponse.body.galleryUrl || !shareResponse.body.galleryApiUrl) {
    throw new Error(`Gallery share failed: ${JSON.stringify(shareResponse)}`);
  }

  const [publicApiResponse, publicPageResponse] = await Promise.all([
    fetch(shareResponse.body.galleryApiUrl),
    fetch(shareResponse.body.galleryUrl),
  ]);

  const publicApiBody = (await publicApiResponse.json()) as {
    gallery?: { status?: string; viewCount?: number };
    photos?: unknown[];
  };
  const publicPageHtml = await publicPageResponse.text();

  const [storedGallery, storedPhotos, queueCounts, dlqCounts] = await Promise.all([
    withAuroraResumeRetry(() => galleriesService.getGalleryById(galleryId)) as Promise<GalleryRecord | null>,
    withAuroraResumeRetry(() => photosService.listPhotosByGallery(galleryId, true)),
    getQueueCounts(galleryIngressQueueUrl),
    getQueueCounts(galleryIngressDlqUrl),
  ]);

  const totalDurationMs = Date.now() - startedAt;
  const uploadDurationMs = uploadCompletedAt - uploadStartedAt;
  const processingDurationMs = Date.now() - uploadCompletedAt;
  const publicPhotoCount = Array.isArray(publicApiBody.photos) ? publicApiBody.photos.length : 0;

  if (!storedGallery || storedGallery.status !== "ready") {
    throw new Error(`Gallery ${galleryId} did not reach ready status.`);
  }

  if (storedGallery.processedPhotoCount !== proofPhotoCount) {
    throw new Error(
      `Expected ${proofPhotoCount} processed photos but saw ${storedGallery.processedPhotoCount} on gallery ${galleryId}.`,
    );
  }

  if (storedPhotos.length !== proofPhotoCount) {
    throw new Error(`Expected ${proofPhotoCount} photo rows but saw ${storedPhotos.length} for gallery ${galleryId}.`);
  }

  if (!publicApiResponse.ok || publicPhotoCount !== proofPhotoCount) {
    throw new Error(`Public gallery API returned ${publicPhotoCount} photos with status ${publicApiResponse.status}.`);
  }

  if (!publicPageResponse.ok || !publicPageHtml.includes(storedGallery.title ?? "")) {
    throw new Error(`Public gallery page failed with status ${publicPageResponse.status}.`);
  }

  if (dlqCounts.visible !== 0 || dlqCounts.notVisible !== 0) {
    throw new Error(`Gallery DLQ is not empty: ${JSON.stringify(dlqCounts)}.`);
  }

  if (totalDurationMs > readyTimeoutMs) {
    throw new Error(`End-to-end duration ${totalDurationMs}ms exceeded timeout ${readyTimeoutMs}ms.`);
  }

  console.log(
    JSON.stringify(
      {
        apiUrl: requireOutput(apiOutputs, "ApiUrl"),
        galleryId,
        galleryApiUrl: shareResponse.body.galleryApiUrl,
        galleryUrl: shareResponse.body.galleryUrl,
        expectedPhotoCount: proofPhotoCount,
        storedPhotoCount: storedPhotos.length,
        publicPhotoCount,
        galleryStatus: readyGallery.status,
        processedPhotoCount: readyGallery.processedPhotoCount,
        uploadDurationMs,
        processingDurationMs,
        totalDurationMs,
        queueCounts,
        dlqCounts,
        publicApiStatus: publicApiResponse.status,
        publicPageStatus: publicPageResponse.status,
        publicViewCount: publicApiBody.gallery?.viewCount ?? null,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
