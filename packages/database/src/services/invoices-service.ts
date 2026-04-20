// Stage 8 Invoices Service Purpose
import { and, asc, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { invoices, type InvoiceLineItem, type InvoiceSourceType, type InvoiceStatus } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateInvoiceInput = {
  readonly clientId: string;
  readonly sourceType: InvoiceSourceType;
  readonly sourceId?: string | null;
  readonly lineItems?: InvoiceLineItem[];
  readonly subtotalCents?: number;
  readonly taxCents?: number;
  readonly discountCents?: number;
  readonly totalCents?: number;
  readonly paidCents?: number;
  readonly balanceCents?: number;
  readonly status?: InvoiceStatus;
  readonly sentAt?: Date | null;
  readonly dueAt?: Date | null;
  readonly paidAt?: Date | null;
  readonly paymentMethodNote?: string | null;
  readonly refundAmountCents?: number;
  readonly refundReason?: string | null;
  readonly pdfS3Key?: string | null;
  readonly paymentProviderId?: string | null;
  readonly currencyCode?: string;
};

export type UpdateInvoiceInput = Partial<CreateInvoiceInput>;

const computeInvoiceTotals = (input: CreateInvoiceInput | UpdateInvoiceInput, defaults?: typeof invoices.$inferSelect) => {
  const subtotalCents = Math.max(input.subtotalCents ?? defaults?.subtotalCents ?? 0, 0);
  const taxCents = Math.max(input.taxCents ?? defaults?.taxCents ?? 0, 0);
  const discountCents = Math.max(input.discountCents ?? defaults?.discountCents ?? 0, 0);
  const totalCents = Math.max(input.totalCents ?? subtotalCents + taxCents - discountCents, 0);
  const paidCents = Math.max(input.paidCents ?? defaults?.paidCents ?? 0, 0);
  const balanceCents = Math.max(input.balanceCents ?? totalCents - paidCents, 0);

  let status = (input.status ?? defaults?.status ?? "draft") as InvoiceStatus;
  if (status !== "void" && status !== "refunded") {
    if (paidCents >= totalCents && totalCents > 0) {
      status = "paid";
    } else if (paidCents > 0) {
      status = "partial";
    } else if ((input.sentAt ?? defaults?.sentAt) && (input.dueAt ?? defaults?.dueAt) && balanceCents > 0) {
      status = "sent";
    }
  }

  return {
    subtotalCents,
    taxCents,
    discountCents,
    totalCents,
    paidCents,
    balanceCents,
    status,
  };
};

export class InvoicesService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createInvoice(input: CreateInvoiceInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const totals = computeInvoiceTotals(input);
    const inserted = {
      id: createUuid(),
      clientId: input.clientId,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      lineItems: input.lineItems ?? [],
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      discountCents: totals.discountCents,
      totalCents: totals.totalCents,
      paidCents: totals.paidCents,
      balanceCents: totals.balanceCents,
      status: totals.status,
      sentAt: input.sentAt ?? null,
      dueAt: input.dueAt ?? null,
      paidAt: input.paidAt ?? null,
      paymentMethodNote: input.paymentMethodNote ?? null,
      refundAmountCents: Math.max(input.refundAmountCents ?? 0, 0),
      refundReason: input.refundReason ?? null,
      pdfS3Key: input.pdfS3Key ?? null,
      paymentProviderId: input.paymentProviderId ?? null,
      currencyCode: (input.currencyCode ?? "USD").toUpperCase(),
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    return this.persistMutation(context, async (database) => {
      await database.insert(invoices).values(inserted);

      return {
        entityName: "invoice",
        eventName: "created",
        entityId: inserted.id,
        before: null,
        after: inserted,
        result: inserted,
      };
    });
  }

  public async updateInvoice(id: string, input: UpdateInvoiceInput, context: MutationContext) {
    const existing = await this.getInvoiceById(id);
    if (!existing) {
      throw new Error(`Invoice ${id} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const totals = computeInvoiceTotals(input, existing);
    const updated = {
      ...existing,
      clientId: input.clientId ?? existing.clientId,
      sourceType: input.sourceType ?? existing.sourceType,
      sourceId: input.sourceId !== undefined ? input.sourceId : existing.sourceId,
      lineItems: input.lineItems ?? existing.lineItems,
      subtotalCents: totals.subtotalCents,
      taxCents: totals.taxCents,
      discountCents: totals.discountCents,
      totalCents: totals.totalCents,
      paidCents: totals.paidCents,
      balanceCents: totals.balanceCents,
      status: totals.status,
      sentAt: input.sentAt !== undefined ? input.sentAt : existing.sentAt,
      dueAt: input.dueAt !== undefined ? input.dueAt : existing.dueAt,
      paidAt: input.paidAt !== undefined ? input.paidAt : existing.paidAt,
      paymentMethodNote: input.paymentMethodNote !== undefined ? input.paymentMethodNote : existing.paymentMethodNote,
      refundAmountCents: input.refundAmountCents !== undefined ? Math.max(input.refundAmountCents, 0) : existing.refundAmountCents,
      refundReason: input.refundReason !== undefined ? input.refundReason : existing.refundReason,
      pdfS3Key: input.pdfS3Key !== undefined ? input.pdfS3Key : existing.pdfS3Key,
      paymentProviderId: input.paymentProviderId !== undefined ? input.paymentProviderId : existing.paymentProviderId,
      currencyCode: (input.currencyCode ?? existing.currencyCode).toUpperCase(),
      updatedAt: occurredAt,
      version: existing.version + 1,
    };

    return this.persistMutation(context, async (database) => {
      await database
        .update(invoices)
        .set({
          clientId: updated.clientId,
          sourceType: updated.sourceType,
          sourceId: updated.sourceId,
          lineItems: updated.lineItems,
          subtotalCents: updated.subtotalCents,
          taxCents: updated.taxCents,
          discountCents: updated.discountCents,
          totalCents: updated.totalCents,
          paidCents: updated.paidCents,
          balanceCents: updated.balanceCents,
          status: updated.status,
          sentAt: updated.sentAt,
          dueAt: updated.dueAt,
          paidAt: updated.paidAt,
          paymentMethodNote: updated.paymentMethodNote,
          refundAmountCents: updated.refundAmountCents,
          refundReason: updated.refundReason,
          pdfS3Key: updated.pdfS3Key,
          paymentProviderId: updated.paymentProviderId,
          currencyCode: updated.currencyCode,
          updatedAt: updated.updatedAt,
          version: updated.version,
        })
        .where(eq(invoices.id, id));

      return {
        entityName: "invoice",
        eventName: "updated",
        entityId: id,
        before: existing,
        after: updated,
        result: updated,
      };
    });
  }

  public async applyPayment(invoiceId: string, deltaCents: number, context: MutationContext, paymentMethodNote?: string | null) {
    const existing = await this.getInvoiceById(invoiceId);
    if (!existing) {
      throw new Error(`Invoice ${invoiceId} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const paidCents = Math.max(existing.paidCents + deltaCents, 0);
    const balanceCents = Math.max(existing.totalCents - paidCents, 0);
    const status: InvoiceStatus =
      paidCents >= existing.totalCents && existing.totalCents > 0
        ? "paid"
        : paidCents > 0
          ? "partial"
          : existing.status === "paid"
            ? "sent"
            : existing.status;

    const updated = {
      ...existing,
      paidCents,
      balanceCents,
      status,
      paidAt: status === "paid" ? occurredAt : existing.paidAt,
      paymentMethodNote: paymentMethodNote ?? existing.paymentMethodNote,
      updatedAt: occurredAt,
      version: existing.version + 1,
    };

    return this.persistMutation(context, async (database) => {
      await database
        .update(invoices)
        .set({
          paidCents: updated.paidCents,
          balanceCents: updated.balanceCents,
          status: updated.status,
          paidAt: updated.paidAt,
          paymentMethodNote: updated.paymentMethodNote,
          updatedAt: updated.updatedAt,
          version: updated.version,
        })
        .where(eq(invoices.id, invoiceId));

      return {
        entityName: "invoice",
        eventName: "updated",
        entityId: invoiceId,
        before: existing,
        after: updated,
        result: updated,
      };
    });
  }

  public async applyRefund(
    invoiceId: string,
    refundCents: number,
    context: MutationContext,
    input: {
      readonly paymentMethodNote?: string | null;
      readonly refundReason?: string | null;
    } = {},
  ) {
    const existing = await this.getInvoiceById(invoiceId);
    if (!existing) {
      throw new Error(`Invoice ${invoiceId} was not found.`);
    }

    const safeRefundCents = Math.max(refundCents, 0);
    if (safeRefundCents <= 0) {
      throw new Error("Refund amount must be greater than zero.");
    }

    const occurredAt = context.occurredAt ?? new Date();
    const paidCents = Math.max(existing.paidCents - safeRefundCents, 0);
    const balanceCents = Math.max(existing.totalCents - paidCents, 0);
    const refundAmountCents = existing.refundAmountCents + safeRefundCents;
    const status: InvoiceStatus =
      refundAmountCents >= existing.totalCents
        ? "refunded"
        : paidCents > 0
          ? "partial"
          : existing.sentAt || existing.dueAt
            ? "sent"
            : "draft";

    const updated = {
      ...existing,
      paidCents,
      balanceCents,
      status,
      paidAt: paidCents <= 0 ? null : existing.paidAt,
      paymentMethodNote: input.paymentMethodNote ?? existing.paymentMethodNote,
      refundAmountCents,
      refundReason: input.refundReason ?? existing.refundReason,
      updatedAt: occurredAt,
      version: existing.version + 1,
    };

    return this.persistMutation(context, async (database) => {
      await database
        .update(invoices)
        .set({
          paidCents: updated.paidCents,
          balanceCents: updated.balanceCents,
          status: updated.status,
          paidAt: updated.paidAt,
          paymentMethodNote: updated.paymentMethodNote,
          refundAmountCents: updated.refundAmountCents,
          refundReason: updated.refundReason,
          updatedAt: updated.updatedAt,
          version: updated.version,
        })
        .where(eq(invoices.id, invoiceId));

      return {
        entityName: "invoice",
        eventName: "updated",
        entityId: invoiceId,
        before: existing,
        after: updated,
        result: updated,
      };
    });
  }

  public async getInvoiceById(id: string) {
    const rows = await this.database
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, id), isNull(invoices.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }

  public async listInvoices(input: { readonly clientId?: string; readonly status?: InvoiceStatus } = {}) {
    return this.database
      .select()
      .from(invoices)
      .where(
        and(
          isNull(invoices.deletedAt),
          input.clientId ? eq(invoices.clientId, input.clientId) : undefined,
          input.status ? eq(invoices.status, input.status) : undefined,
        ),
      )
      .orderBy(asc(invoices.dueAt), asc(invoices.createdAt));
  }
}
