// Stage 8 Financial Schema Purpose
import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns, requiredBoolean } from "./common";
import { clients } from "./clients";

export const invoiceSourceTypes = ["session", "studio_booking", "standalone"] as const;
export type InvoiceSourceType = (typeof invoiceSourceTypes)[number];

export const invoiceStatuses = ["draft", "sent", "partial", "paid", "overdue", "void", "refunded"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const expenseCategories = [
  "gear",
  "software",
  "studio_rent",
  "utilities",
  "travel",
  "meals",
  "marketing",
  "legal",
  "contractor",
  "insurance",
  "other",
] as const;
export type ExpenseCategory = (typeof expenseCategories)[number];

export const receiptScanStatuses = ["pending", "processing", "completed", "failed"] as const;
export type ReceiptScanStatus = (typeof receiptScanStatuses)[number];

export type InvoiceLineItem = Record<string, unknown>;
export type ReceiptScanOcrResult = Record<string, unknown>;

export const invoices = pgTable(
  "invoices",
  {
    ...baseColumns,
    clientId: uuid("client_id").references(() => clients.id).notNull(),
    sourceType: varchar("source_type", { length: 32 }).$type<InvoiceSourceType>().notNull(),
    sourceId: uuid("source_id"),
    lineItems: jsonb("line_items").$type<InvoiceLineItem[]>().notNull().default(sql`'[]'::jsonb`),
    subtotalCents: integer("subtotal_cents").notNull().default(0),
    taxCents: integer("tax_cents").notNull().default(0),
    discountCents: integer("discount_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    paidCents: integer("paid_cents").notNull().default(0),
    balanceCents: integer("balance_cents").notNull().default(0),
    status: varchar("status", { length: 32 }).$type<InvoiceStatus>().notNull().default("draft"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    dueAt: timestamp("due_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentMethodNote: text("payment_method_note"),
    refundAmountCents: integer("refund_amount_cents").notNull().default(0),
    refundReason: text("refund_reason"),
    pdfS3Key: text("pdf_s3_key"),
    paymentProviderId: text("payment_provider_id"),
    currencyCode: varchar("currency_code", { length: 3 }).notNull().default("USD"),
  },
  (table) => ({
    clientDueIndex: index("invoices_client_due_idx").on(table.clientId, table.dueAt),
    sourceIndex: index("invoices_source_idx").on(table.sourceType, table.sourceId),
    statusDueIndex: index("invoices_status_due_idx").on(table.status, table.dueAt),
  }),
);

export const payments = pgTable(
  "payments",
  {
    ...baseColumns,
    invoiceId: uuid("invoice_id").references(() => invoices.id).notNull(),
    amountCents: integer("amount_cents").notNull(),
    method: varchar("method", { length: 64 }).notNull(),
    referenceNote: text("reference_note"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    recordedBy: varchar("recorded_by", { length: 64 }).notNull().default("kevin"),
    pdfReceiptS3Key: text("pdf_receipt_s3_key"),
    providerTransactionId: text("provider_transaction_id"),
    currencyCode: varchar("currency_code", { length: 3 }).notNull().default("USD"),
  },
  (table) => ({
    invoiceReceivedIndex: index("payments_invoice_received_idx").on(table.invoiceId, table.receivedAt),
    providerTransactionIndex: index("payments_provider_transaction_idx").on(table.providerTransactionId),
  }),
);

export const expenseReceiptScans = pgTable(
  "expense_receipt_scans",
  {
    ...baseColumns,
    receiptS3Key: text("receipt_s3_key").notNull(),
    status: varchar("status", { length: 32 }).$type<ReceiptScanStatus>().notNull().default("pending"),
    fileName: text("file_name"),
    contentType: text("content_type"),
    vendor: text("vendor"),
    receiptDate: timestamp("receipt_date", { withTimezone: true }),
    totalCents: integer("total_cents"),
    taxCents: integer("tax_cents"),
    ocrResult: jsonb("ocr_result").$type<ReceiptScanOcrResult>().notNull().default(sql`'{}'::jsonb`),
    failureReason: text("failure_reason"),
  },
  (table) => ({
    receiptKeyIndex: index("expense_receipt_scans_receipt_key_idx").on(table.receiptS3Key),
    statusCreatedIndex: index("expense_receipt_scans_status_created_idx").on(table.status, table.createdAt),
  }),
);

export const expenses = pgTable(
  "expenses",
  {
    ...baseColumns,
    spentAt: timestamp("spent_at", { withTimezone: true }).notNull(),
    category: varchar("category", { length: 32 }).$type<ExpenseCategory>().notNull(),
    description: text("description").notNull(),
    amountCents: integer("amount_cents").notNull(),
    paymentMethod: varchar("payment_method", { length: 64 }),
    vendor: text("vendor"),
    receiptS3Key: text("receipt_s3_key"),
    receiptScanId: uuid("receipt_scan_id").references(() => expenseReceiptScans.id),
    taxDeductible: requiredBoolean("tax_deductible", true),
    projectId: uuid("project_id"),
    notes: text("notes"),
    currencyCode: varchar("currency_code", { length: 3 }).notNull().default("USD"),
    ocrMetadata: jsonb("ocr_metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (table) => ({
    categorySpentIndex: index("expenses_category_spent_idx").on(table.category, table.spentAt),
    receiptScanIndex: index("expenses_receipt_scan_idx").on(table.receiptScanId),
    vendorSpentIndex: index("expenses_vendor_spent_idx").on(table.vendor, table.spentAt),
  }),
);
