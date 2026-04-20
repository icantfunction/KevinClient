// Stage 8 Expense Receipt Scan Upload Lambda Purpose
import { createUuid } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";
import { buildReceiptObjectKey, createReceiptUploadUrl } from "../shared/receipt-upload";

type CreateReceiptScanRequest = {
  readonly filename?: string;
  readonly contentType?: string;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/expenses/receipt-scans:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateReceiptScanRequest>(event);
    if (!payload.filename?.trim() || !payload.contentType?.trim()) {
      return jsonResponse(400, { error: "filename and contentType are required." });
    }

    const scanId = createUuid();
    const objectKey = buildReceiptObjectKey(scanId, payload.filename.trim());
    const upload = await createReceiptUploadUrl(objectKey, payload.contentType.trim());
    const { expenseReceiptScansService } = createStage3Services();
    const scan = await expenseReceiptScansService.createPendingScan(
      {
        receiptS3Key: objectKey,
        fileName: payload.filename.trim(),
        contentType: payload.contentType.trim(),
      },
      {
        actor: "kevin",
        occurredAt: new Date(),
      },
    );

    const response = jsonResponse(201, {
      scan,
      upload,
    });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
