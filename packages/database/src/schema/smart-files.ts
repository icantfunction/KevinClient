// Stage 5 Smart Files Schema Purpose
import { index, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { baseColumns, requiredBoolean } from "./common";
import { clients } from "./clients";
import { inquiries } from "./inquiries";
import { sessions } from "./sessions";

export const smartFileBlockTypes = [
  "CONTRACT_BLOCK",
  "QUESTIONNAIRE_BLOCK",
  "INVOICE_BLOCK",
  "PAYMENT_BLOCK",
  "SERVICE_SELECTION_BLOCK",
  "SCHEDULING_BLOCK",
  "TEXT_BLOCK",
  "IMAGE_BLOCK",
  "FILE_UPLOAD_BLOCK",
  "WAIVER_BLOCK",
] as const;

export type SmartFileBlockType = (typeof smartFileBlockTypes)[number];

export type SmartFileBlock = {
  readonly id: string;
  readonly type: SmartFileBlockType;
  readonly order: number;
  readonly title?: string | null;
  readonly content?: string | null;
  readonly settings?: Record<string, unknown>;
};

export const smartFileStatuses = [
  "draft",
  "sent",
  "viewed",
  "partially_completed",
  "signed",
  "paid",
  "completed",
  "archived",
] as const;

export type SmartFileStatus = (typeof smartFileStatuses)[number];

export const signatureMethods = ["typed", "drawn"] as const;
export type SignatureMethod = (typeof signatureMethods)[number];

export const smartFileTemplates = pgTable(
  "smart_file_templates",
  {
    ...baseColumns,
    name: text("name").notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    description: text("description"),
    active: requiredBoolean("active", true),
    latestVersionNumber: integer("latest_version_number").notNull().default(1),
  },
  (table) => ({
    nameIndex: index("smart_file_templates_name_idx").on(table.name),
  }),
);

export const smartFileTemplateVersions = pgTable(
  "smart_file_template_versions",
  {
    ...baseColumns,
    templateId: uuid("template_id").references(() => smartFileTemplates.id).notNull(),
    versionNumber: integer("version_number").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    blocks: jsonb("blocks").$type<SmartFileBlock[]>().notNull().default(sql`'[]'::jsonb`),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (table) => ({
    templateVersionIndex: index("smart_file_template_versions_template_version_idx").on(table.templateId, table.versionNumber),
  }),
);

export const smartFiles = pgTable(
  "smart_files",
  {
    ...baseColumns,
    templateId: uuid("template_id").references(() => smartFileTemplates.id),
    templateVersionId: uuid("template_version_id").references(() => smartFileTemplateVersions.id),
    clientId: uuid("client_id").references(() => clients.id),
    inquiryId: uuid("inquiry_id").references(() => inquiries.id),
    sessionId: uuid("session_id").references(() => sessions.id),
    title: text("title").notNull(),
    status: varchar("status", { length: 32 }).$type<SmartFileStatus>().notNull().default("draft"),
    recipientEmail: text("recipient_email"),
    recipientPhone: text("recipient_phone"),
    subject: text("subject"),
    message: text("message"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    viewedAt: timestamp("viewed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    scheduledSendAt: timestamp("scheduled_send_at", { withTimezone: true }),
    snapshotBlocks: jsonb("snapshot_blocks").$type<SmartFileBlock[]>().notNull().default(sql`'[]'::jsonb`),
    responseData: jsonb("response_data").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    auditSummary: jsonb("audit_summary").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    pdfS3Key: text("pdf_s3_key"),
    lastPublicTokenAt: timestamp("last_public_token_at", { withTimezone: true }),
    lastPublicTokenExpiresAt: timestamp("last_public_token_expires_at", { withTimezone: true }),
  },
  (table) => ({
    statusIndex: index("smart_files_status_idx").on(table.status, table.sentAt),
    clientIndex: index("smart_files_client_idx").on(table.clientId, table.createdAt),
  }),
);

export const smartFileSignatures = pgTable(
  "smart_file_signatures",
  {
    ...baseColumns,
    smartFileId: uuid("smart_file_id").references(() => smartFiles.id).notNull(),
    signatureMethod: varchar("signature_method", { length: 16 }).$type<SignatureMethod>().notNull(),
    signatureName: text("signature_name").notNull(),
    signatureSvg: text("signature_svg"),
    signatureImageS3Key: text("signature_image_s3_key"),
    signedAt: timestamp("signed_at", { withTimezone: true }).notNull(),
    signerIp: text("signer_ip"),
    signerUserAgent: text("signer_user_agent"),
    signerGeolocation: jsonb("signer_geolocation").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    documentHashAtSigning: text("document_hash_at_signing").notNull(),
    verificationPhone: text("verification_phone"),
    verificationVerifiedAt: timestamp("verification_verified_at", { withTimezone: true }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (table) => ({
    smartFileIndex: index("smart_file_signatures_smart_file_idx").on(table.smartFileId, table.signedAt),
  }),
);
