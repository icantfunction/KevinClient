// Stage 8 Expenses Service Purpose
import { and, asc, eq, gte, isNull, lte } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { expenses, type ExpenseCategory } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateExpenseInput = {
  readonly spentAt: Date;
  readonly category: ExpenseCategory;
  readonly description: string;
  readonly amountCents: number;
  readonly paymentMethod?: string | null;
  readonly vendor?: string | null;
  readonly receiptS3Key?: string | null;
  readonly receiptScanId?: string | null;
  readonly taxDeductible?: boolean;
  readonly projectId?: string | null;
  readonly notes?: string | null;
  readonly currencyCode?: string;
  readonly ocrMetadata?: Record<string, unknown>;
};

export type ListExpensesInput = {
  readonly category?: ExpenseCategory;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
};

export class ExpensesService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createExpense(input: CreateExpenseInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const amountCents = Math.max(input.amountCents, 0);
    if (amountCents <= 0) {
      throw new Error("Expense amount must be greater than zero.");
    }

    const inserted = {
      id: createUuid(),
      spentAt: input.spentAt,
      category: input.category,
      description: input.description.trim(),
      amountCents,
      paymentMethod: input.paymentMethod?.trim() || null,
      vendor: input.vendor?.trim() || null,
      receiptS3Key: input.receiptS3Key ?? null,
      receiptScanId: input.receiptScanId ?? null,
      taxDeductible: input.taxDeductible ?? true,
      projectId: input.projectId ?? null,
      notes: input.notes ?? null,
      currencyCode: (input.currencyCode ?? "USD").toUpperCase(),
      ocrMetadata: input.ocrMetadata ?? {},
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    await this.database.insert(expenses).values(inserted);

    return this.recordMutation(context, {
      entityName: "expense",
      eventName: "created",
      entityId: inserted.id,
      before: null,
      after: inserted,
      result: inserted,
    });
  }

  public async listExpenses(input: ListExpensesInput = {}) {
    return this.database
      .select()
      .from(expenses)
      .where(
        and(
          isNull(expenses.deletedAt),
          input.category ? eq(expenses.category, input.category) : undefined,
          input.from ? gte(expenses.spentAt, input.from) : undefined,
          input.to ? lte(expenses.spentAt, input.to) : undefined,
        ),
      )
      .orderBy(asc(expenses.spentAt), asc(expenses.createdAt))
      .limit(Math.min(input.limit ?? 100, 250));
  }
}
