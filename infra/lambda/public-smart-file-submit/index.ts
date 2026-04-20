// Stage 5 Public Smart File Submit Lambda Purpose
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { SignatureMethod } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse, parseJsonBody } from "../shared/http";
import { verifySmartFilePublicToken } from "../shared/smart-file-public-token";
import { verifySmartFileVerificationCode } from "../shared/smart-file-verification";

type SubmitSmartFileRequest = {
  readonly responseData?: Record<string, unknown>;
  readonly signatureMethod?: SignatureMethod;
  readonly signatureName?: string;
  readonly signatureSvg?: string | null;
  readonly verificationCode?: string;
};

const queueUrl = process.env.STUDIO_OS_SMART_FILE_PDF_QUEUE_URL;
const sqsClient = new SQSClient({});

if (!queueUrl) {
  throw new Error("Missing required environment variable: STUDIO_OS_SMART_FILE_PDF_QUEUE_URL");
}

export const handler = async (event: APIGatewayProxyEventV2) => {
  const token = event.pathParameters?.token;
  if (!token) {
    return jsonResponse(400, { error: "Smart File token is required." });
  }

  try {
    const { smartFileId } = await verifySmartFilePublicToken(token);
    const payload = parseJsonBody<SubmitSmartFileRequest>(event);
    const { activitiesService, smartFilesService } = createStage3Services();
    const smartFile = await smartFilesService.getSmartFileById(smartFileId);
    if (!smartFile) {
      return jsonResponse(404, { error: "smart file not found." });
    }

    const occurredAt = new Date();
    const mergedResponseData = {
      ...smartFile.responseData,
      ...(payload.responseData ?? {}),
    };

    await smartFilesService.updateResponseData(smartFile.id, mergedResponseData, {
      actor: "client:smart_file",
      occurredAt,
    });

    if (!smartFile.recipientPhone || !payload.verificationCode || !payload.signatureMethod || !payload.signatureName?.trim()) {
      return jsonResponse(400, {
        error: "recipient phone, verificationCode, signatureMethod, and signatureName are required to submit.",
      });
    }

    await verifySmartFileVerificationCode(smartFile.id, smartFile.recipientPhone, payload.verificationCode);
    const context = await smartFilesService.buildSmartFieldContext(smartFile.id);
    const renderedBlocks = smartFilesService.resolveBlocks(smartFile.snapshotBlocks, context, mergedResponseData);

    const signature = await smartFilesService.recordSignature(
      smartFile.id,
      {
        signatureMethod: payload.signatureMethod,
        signatureName: payload.signatureName.trim(),
        signatureSvg: payload.signatureSvg ?? null,
        signerIp: event.requestContext.http.sourceIp,
        signerUserAgent: event.headers["user-agent"] ?? null,
        signerGeolocation: {},
        verificationPhone: smartFile.recipientPhone,
        verificationVerifiedAt: occurredAt,
        renderedDocument: {
          smartFileId: smartFile.id,
          blocks: renderedBlocks,
          responseData: mergedResponseData,
        },
      },
      { actor: "client:smart_file", occurredAt },
    );

    await activitiesService.createActivity(
      {
        clientId: smartFile.clientId ?? null,
        scopeType: "smart_file",
        scopeId: smartFile.id,
        channel: "system",
        direction: "inbound",
        activityType: "smart_file.signed",
        subject: smartFile.title,
        body: `${payload.signatureName.trim()} signed the Smart File.`,
        occurredAt,
        metadata: {
          signatureMethod: payload.signatureMethod,
        },
      },
      { actor: "client:smart_file", occurredAt },
    );

    await sqsClient.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify({
          smartFileId: smartFile.id,
        }),
      }),
    );

    return jsonResponse(200, {
      submitted: true,
      signature,
    });
  } catch (error) {
    return jsonResponse(401, { error: error instanceof Error ? error.message : "Smart File submission failed." });
  }
};
