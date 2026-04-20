// Stage 8 Expense Receipt Scans Service Purpose
import { and, asc, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import {
  expenseReceiptScans,
  type ReceiptScanOcrResult,
  type ReceiptScanStatus,
} from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateExpenseReceiptScanInput = {
  readonly receiptS3Key: string;
  readonly fileName?: string | null;
  readonly contentType?: string | null;
};

export type UpdateExpenseReceiptScanInput = {
  readonly status?: ReceiptScanStatus;
  readonly vendor?: string | null;
  readonly receiptDate?: Date | null;
  readonly totalCents?: number | null;
  readonly taxCents?: number | null;
  readonly ocrResult?: ReceiptScanOcrResult;
  readonly failureReason?: string | null;
};

export class ExpenseReceiptScansService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createPendingScan(input: CreateExpenseReceiptScanInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const inserted = {
      id: createUuid(),
      receiptS3Key: input.receiptS3Key,
      status: "pending" as ReceiptScanStatus,
      fileName: input.fileName ?? null,
      contentType: input.contentType ?? null,
      vendor: null,
      receiptDate: null,
      totalCents: null,
      taxCents: null,
      ocrResult: {},
      failureReason: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    return this.persistMutation(context, async (database) => {
      await database.insert(expenseReceiptScans).values(inserted);

      return {
        entityName: "expense_receipt_scan",
        eventName: "created",
        entityId: inserted.id,
        before: null,
        after: inserted,
        result: inserted,
      };
    });
  }

  public async updateScan(id: string, input: UpdateExpenseReceiptScanInput, context: MutationContext) {
    const existing = await this.getScanById(id);
    if (!existing) {
      throw new Error(`Expense receipt scan ${id} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const updated = {
      ...existing,
      status: input.status ?? existing.status,
      vendor: input.vendor !== undefined ? input.vendor : existing.vendor,
      receiptDate: input.receiptDate !== undefined ? input.receiptDate : existing.receiptDate,
      totalCents: input.totalCents !== undefined ? input.totalCents : existing.totalCents,
      taxCents: input.taxCents !== undefined ? input.taxCents : existing.taxCents,
      ocrResult: input.ocrResult ?? existing.ocrResult,
      failureReason: input.failureReason !== undefined ? input.failureReason : existing.failureReason,
      updatedAt: occurredAt,
      version: existing.version + 1,
    };

    return this.persistMutation(context, async (database) => {
      await database
        .update(expenseReceiptScans)
        .set({
          status: updated.status,
          vendor: updated.vendor,
          receiptDate: updated.receiptDate,
          totalCents: updated.totalCents,
          taxCents: updated.taxCents,
          ocrResult: updated.ocrResult,
          failureReason: updated.failureReason,
          updatedAt: updated.updatedAt,
          version: updated.version,
        })
        .where(eq(expenseReceiptScans.id, id));

      return {
        entityName: "expense_receipt_scan",
        eventName: "updated",
        entityId: id,
        before: existing,
        after: updated,
        result: updated,
      };
    });
  }

  public async markProcessing(id: string, context: MutationContext) {
    return this.updateScan(
      id,
      {
        status: "processing",
        failureReason: null,
      },
      context,
    );
  }

  public async completeScan(
    id: string,
    input: {
      readonly vendor?: string | null;
      readonly receiptDate?: Date | null;
      readonly totalCents?: number | null;
      readonly taxCents?: number | null;
      readonly ocrResult: ReceiptScanOcrResult;
    },
    context: MutationContext,
  ) {
    return this.updateScan(
      id,
      {
        status: "completed",
        vendor: input.vendor ?? null,
        receiptDate: input.receiptDate ?? null,
        totalCents: input.totalCents ?? null,
        taxCents: input.taxCents ?? null,
        ocrResult: input.ocrResult,
        failureReason: null,
      },
      context,
    );
  }

  public async failScan(id: string, reason: string, context: MutationContext) {
    return this.updateScan(
      id,
      {
        status: "failed",
        failureReason: reason,
      },
      context,
    );
  }

  public async getScanById(id: string) {
    const rows = await this.database
      .select()
      .from(expenseReceiptScans)
      .where(and(eq(expenseReceiptScans.id, id), isNull(expenseReceiptScans.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }

  public async getScanByReceiptKey(receiptS3Key: string) {
    const rows = await this.database
      .select()
      .from(expenseReceiptScans)
      .where(and(eq(expenseReceiptScans.receiptS3Key, receiptS3Key), isNull(expenseReceiptScans.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }

  public async listScans(input: { readonly status?: ReceiptScanStatus; readonly limit?: number } = {}) {
    return this.database
      .select()
      .from(expenseReceiptScans)
      .where(
        and(
          isNull(expenseReceiptScans.deletedAt),
          input.status ? eq(expenseReceiptScans.status, input.status) : undefined,
        ),
      )
      .orderBy(asc(expenseReceiptScans.createdAt))
      .limit(Math.min(input.limit ?? 50, 100));
  }
}
