// Stage 8 Payments Service Purpose
import { and, asc, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { payments } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";
import { InvoicesService } from "./invoices-service";

export type CreatePaymentInput = {
  readonly invoiceId: string;
  readonly amountCents: number;
  readonly method: string;
  readonly referenceNote?: string | null;
  readonly receivedAt?: Date;
  readonly recordedBy?: string;
  readonly pdfReceiptS3Key?: string | null;
  readonly providerTransactionId?: string | null;
  readonly currencyCode?: string;
};

export type CreateRefundPaymentInput = {
  readonly invoiceId: string;
  readonly amountCents: number;
  readonly method: string;
  readonly referenceNote?: string | null;
  readonly receivedAt?: Date;
  readonly recordedBy?: string;
  readonly pdfReceiptS3Key?: string | null;
  readonly providerTransactionId?: string | null;
  readonly currencyCode?: string;
  readonly refundReason?: string | null;
};

export class PaymentsService extends BaseDomainService {
  private readonly invoicesService: InvoicesService;

  public constructor(database: StudioOsDatabase) {
    super(database);
    this.invoicesService = new InvoicesService(database);
  }

  public async createPayment(input: CreatePaymentInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const amountCents = Math.max(input.amountCents, 0);
    if (amountCents <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const inserted = {
      id: createUuid(),
      invoiceId: input.invoiceId,
      amountCents,
      method: input.method.trim(),
      referenceNote: input.referenceNote ?? null,
      receivedAt: input.receivedAt ?? occurredAt,
      recordedBy: input.recordedBy ?? "kevin",
      pdfReceiptS3Key: input.pdfReceiptS3Key ?? null,
      providerTransactionId: input.providerTransactionId ?? null,
      currencyCode: (input.currencyCode ?? "USD").toUpperCase(),
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    const payment = await this.persistMutation(context, async (database) => {
      await database.insert(payments).values(inserted);

      return {
        entityName: "payment",
        eventName: "created",
        entityId: inserted.id,
        before: null,
        after: inserted,
        result: inserted,
      };
    });

    await this.invoicesService.applyPayment(
      input.invoiceId,
      amountCents,
      context,
      input.referenceNote ? `${input.method}: ${input.referenceNote}` : input.method,
    );

    return payment;
  }

  public async createRefundPayment(input: CreateRefundPaymentInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const amountCents = Math.max(input.amountCents, 0);
    if (amountCents <= 0) {
      throw new Error("Refund amount must be greater than zero.");
    }

    const inserted = {
      id: createUuid(),
      invoiceId: input.invoiceId,
      amountCents: amountCents * -1,
      method: input.method.trim(),
      referenceNote: input.referenceNote ?? null,
      receivedAt: input.receivedAt ?? occurredAt,
      recordedBy: input.recordedBy ?? "kevin",
      pdfReceiptS3Key: input.pdfReceiptS3Key ?? null,
      providerTransactionId: input.providerTransactionId ?? null,
      currencyCode: (input.currencyCode ?? "USD").toUpperCase(),
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    const payment = await this.persistMutation(context, async (database) => {
      await database.insert(payments).values(inserted);

      return {
        entityName: "payment",
        eventName: "created",
        entityId: inserted.id,
        before: null,
        after: inserted,
        result: inserted,
      };
    });

    await this.invoicesService.applyRefund(input.invoiceId, amountCents, context, {
      paymentMethodNote: input.referenceNote ? `${input.method}: ${input.referenceNote}` : input.method,
      refundReason: input.refundReason ?? null,
    });

    return payment;
  }

  public async getPaymentById(id: string) {
    const rows = await this.database
      .select()
      .from(payments)
      .where(and(isNull(payments.deletedAt), eq(payments.id, id)))
      .limit(1);

    return rows[0] ?? null;
  }

  public async getPaymentByProviderTransactionId(providerTransactionId: string) {
    const rows = await this.database
      .select()
      .from(payments)
      .where(and(isNull(payments.deletedAt), eq(payments.providerTransactionId, providerTransactionId)))
      .limit(1);

    return rows[0] ?? null;
  }

  public async listPayments(input: { readonly invoiceId?: string; readonly limit?: number } = {}) {
    return this.database
      .select()
      .from(payments)
      .where(and(isNull(payments.deletedAt), input.invoiceId ? eq(payments.invoiceId, input.invoiceId) : undefined))
      .orderBy(asc(payments.receivedAt))
      .limit(Math.min(input.limit ?? 200, 500));
  }
}
