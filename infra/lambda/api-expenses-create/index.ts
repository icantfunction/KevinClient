// Stage 8 Expenses Create Lambda Purpose
import { expenseCategories } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreateExpenseRequest = {
  readonly spentAt?: string | null;
  readonly category?: string;
  readonly description?: string;
  readonly amountCents?: number;
  readonly paymentMethod?: string | null;
  readonly vendor?: string | null;
  readonly receiptS3Key?: string | null;
  readonly receiptScanId?: string | null;
  readonly taxDeductible?: boolean;
  readonly projectId?: string | null;
  readonly notes?: string | null;
  readonly currencyCode?: string;
};

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyKeyHeader = getHeader(event, "Idempotency-Key");
  if (!idempotencyKeyHeader) {
    return jsonResponse(400, { error: "Missing Idempotency-Key header." });
  }

  const idempotencyKey = `POST:/expenses:${idempotencyKeyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);
  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateExpenseRequest>(event);
    if (!payload.category || !expenseCategories.includes(payload.category as never) || !payload.description?.trim()) {
      return jsonResponse(400, { error: "category and description are required." });
    }

    const { expensesService, expenseReceiptScansService } = createStage3Services();
    const receiptScan = payload.receiptScanId
      ? await expenseReceiptScansService.getScanById(payload.receiptScanId)
      : null;

    const expense = await expensesService.createExpense(
      {
        spentAt: payload.spentAt
          ? new Date(payload.spentAt)
          : receiptScan?.receiptDate ?? new Date(),
        category: payload.category as (typeof expenseCategories)[number],
        description: payload.description.trim(),
        amountCents: payload.amountCents ?? receiptScan?.totalCents ?? 0,
        paymentMethod: payload.paymentMethod?.trim() || null,
        vendor: payload.vendor?.trim() || receiptScan?.vendor || null,
        receiptS3Key: payload.receiptS3Key ?? receiptScan?.receiptS3Key ?? null,
        receiptScanId: payload.receiptScanId ?? null,
        taxDeductible: payload.taxDeductible ?? true,
        projectId: payload.projectId ?? null,
        notes: payload.notes?.trim() || null,
        currencyCode: payload.currencyCode,
        ocrMetadata: receiptScan
          ? {
              receiptScanId: receiptScan.id,
              ocrResult: receiptScan.ocrResult,
              taxCents: receiptScan.taxCents,
            }
          : {},
      },
      { actor: "kevin", occurredAt: new Date() },
    );

    const response = jsonResponse(201, { expense });
    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    return jsonResponse(500, { error: error instanceof Error ? error.message : "Unexpected error." });
  }
};
