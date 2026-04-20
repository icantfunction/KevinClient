// Stage 8 Expense Receipt OCR Lambda Purpose
import { AnalyzeExpenseCommand, TextractClient } from "@aws-sdk/client-textract";
import type { S3Event } from "aws-lambda";
import { createStage3Services } from "../shared/database";

const textractClient = new TextractClient({});

type SummaryField = {
  readonly Type?: { readonly Text?: string };
  readonly ValueDetection?: { readonly Text?: string };
};

const parseAmountCents = (value?: string): number | null => {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/[^0-9.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : null;
};

const parseReceiptDate = (value?: string): Date | null => {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export const handler = async (event: S3Event) => {
  const { expenseReceiptScansService } = createStage3Services();

  for (const record of event.Records) {
    const bucketName = record.s3.bucket.name;
    const objectKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
    const scan = await expenseReceiptScansService.getScanByReceiptKey(objectKey);
    if (!scan || scan.status === "completed") {
      continue;
    }

    const context = { actor: "system:textract", occurredAt: new Date() };
    try {
      await expenseReceiptScansService.markProcessing(scan.id, context);
      const response = await textractClient.send(
        new AnalyzeExpenseCommand({
          Document: {
            S3Object: {
              Bucket: bucketName,
              Name: objectKey,
            },
          },
        }),
      );

      const summaryFields = (response.ExpenseDocuments?.[0]?.SummaryFields ?? []) as SummaryField[];
      const vendor = summaryFields.find((field) => field.Type?.Text === "VENDOR_NAME")?.ValueDetection?.Text ?? null;
      const totalCents = parseAmountCents(
        summaryFields.find((field) => field.Type?.Text === "TOTAL")?.ValueDetection?.Text,
      );
      const taxCents = parseAmountCents(summaryFields.find((field) => field.Type?.Text === "TAX")?.ValueDetection?.Text);
      const receiptDate = parseReceiptDate(
        summaryFields.find((field) => field.Type?.Text === "INVOICE_RECEIPT_DATE")?.ValueDetection?.Text,
      );

      await expenseReceiptScansService.completeScan(
        scan.id,
        {
          vendor,
          totalCents,
          taxCents,
          receiptDate,
          ocrResult: response as unknown as Record<string, unknown>,
        },
        context,
      );
    } catch (error) {
      await expenseReceiptScansService.failScan(
        scan.id,
        error instanceof Error ? error.message : "Unexpected OCR processing error.",
        { actor: "system:textract", occurredAt: new Date() },
      );
      throw error;
    }
  }
};
