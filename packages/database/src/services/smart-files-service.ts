// Stage 5 Smart Files Service Purpose
import { createHash } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import {
  smartFiles,
  smartFileSignatures,
  type SignatureMethod,
  type SmartFileBlock,
  type SmartFileStatus,
} from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";
import { ClientsService } from "./clients-service";
import { InquiriesService } from "./inquiries-service";
import { SessionsService } from "./sessions-service";
import { SmartFileTemplatesService } from "./smart-file-templates-service";

export type InstantiateSmartFileInput = {
  readonly templateId: string;
  readonly clientId?: string | null;
  readonly inquiryId?: string | null;
  readonly sessionId?: string | null;
  readonly title?: string | null;
  readonly recipientEmail?: string | null;
  readonly recipientPhone?: string | null;
  readonly subject?: string | null;
  readonly message?: string | null;
  readonly expiresAt?: Date | null;
  readonly scheduledSendAt?: Date | null;
};

export type SmartFieldContext = {
  readonly client?: Record<string, unknown> | null;
  readonly inquiry?: Record<string, unknown> | null;
  readonly session?: Record<string, unknown> | null;
  readonly smartFile?: Record<string, unknown> | null;
};

export type ResolvedSmartFileBlock = SmartFileBlock & {
  readonly renderedContent?: string | null;
};

const defaultPhotographerContext = {
  photographer: {
    name: "Kevin",
    business: "Kevin's Studio OS",
  },
  studio: {
    name: "Kevin Creator Studio",
    address: "Miami, FL",
  },
};

const flattenContext = (context: SmartFieldContext) => ({
  client: {
    name: context.client?.primaryName ?? "",
    email: context.client?.email ?? "",
    phone: context.client?.phone ?? "",
  },
  inquiry: {
    eventType: context.inquiry?.eventType ?? "",
  },
  session: {
    date: context.session?.scheduledStart ?? "",
    location: context.session?.locationName ?? "",
    type: context.session?.sessionType ?? "",
  },
  smartFile: {
    title: context.smartFile?.title ?? "",
  },
  today: new Date().toISOString().slice(0, 10),
  ...defaultPhotographerContext,
});

const getPathValue = (source: Record<string, unknown>, path: string): unknown =>
  path.split(".").reduce<unknown>((current, segment) => {
    if (!current || typeof current !== "object" || !(segment in (current as Record<string, unknown>))) {
      return "";
    }

    return (current as Record<string, unknown>)[segment];
  }, source);

export class SmartFilesService extends BaseDomainService {
  private readonly templatesService: SmartFileTemplatesService;
  private readonly clientsService: ClientsService;
  private readonly inquiriesService: InquiriesService;
  private readonly sessionsService: SessionsService;

  public constructor(database: StudioOsDatabase) {
    super(database);
    this.templatesService = new SmartFileTemplatesService(database);
    this.clientsService = new ClientsService(database);
    this.inquiriesService = new InquiriesService(database);
    this.sessionsService = new SessionsService(database);
  }

  public async instantiateSmartFile(input: InstantiateSmartFileInput, context: MutationContext) {
    const template = await this.templatesService.getTemplateById(input.templateId);
    if (!template) {
      throw new Error(`Smart File template ${input.templateId} was not found.`);
    }

    const templateVersion = await this.templatesService.getLatestTemplateVersion(input.templateId);
    if (!templateVersion) {
      throw new Error(`Smart File template ${input.templateId} does not have a version.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const smartFile = {
      id: createUuid(),
      templateId: template.id,
      templateVersionId: templateVersion.id,
      clientId: input.clientId ?? null,
      inquiryId: input.inquiryId ?? null,
      sessionId: input.sessionId ?? null,
      title: input.title ?? templateVersion.title,
      status: "draft" as SmartFileStatus,
      recipientEmail: input.recipientEmail ?? null,
      recipientPhone: input.recipientPhone ?? null,
      subject: input.subject ?? `${templateVersion.title} from Kevin`,
      message: input.message ?? null,
      sentAt: null,
      viewedAt: null,
      completedAt: null,
      expiresAt: input.expiresAt ?? null,
      scheduledSendAt: input.scheduledSendAt ?? null,
      snapshotBlocks: templateVersion.blocks,
      responseData: {},
      auditSummary: {
        templateName: template.name,
        templateVersion: templateVersion.versionNumber,
      },
      pdfS3Key: null,
      lastPublicTokenAt: null,
      lastPublicTokenExpiresAt: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    return this.persistMutation(context, async (database) => {
      await database.insert(smartFiles).values(smartFile);

      return {
        entityName: "smart_file",
        eventName: "created",
        entityId: smartFile.id,
        before: null,
        after: smartFile,
        result: smartFile,
      };
    });
  }

  public async getSmartFileById(id: string) {
    const records = await this.database
      .select()
      .from(smartFiles)
      .where(and(eq(smartFiles.id, id), isNull(smartFiles.deletedAt)))
      .limit(1);

    return records[0] ?? null;
  }

  public async listSmartFiles(input: {
    readonly status?: SmartFileStatus;
  } = {}) {
    return this.database
      .select()
      .from(smartFiles)
      .where(
        and(
          isNull(smartFiles.deletedAt),
          input.status ? eq(smartFiles.status, input.status) : undefined,
        ),
      )
      .orderBy(asc(smartFiles.createdAt));
  }

  public async updateSmartFileStatus(id: string, status: SmartFileStatus, context: MutationContext, extra: Partial<typeof smartFiles.$inferSelect> = {}) {
    const existing = await this.getSmartFileById(id);
    if (!existing) {
      throw new Error(`Smart File ${id} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const updated = {
      ...existing,
      ...extra,
      status,
      updatedAt: occurredAt,
      version: existing.version + 1,
    };

    return this.persistMutation(context, async (database) => {
      await database
        .update(smartFiles)
        .set({
          status: updated.status,
          sentAt: updated.sentAt,
          viewedAt: updated.viewedAt,
          completedAt: updated.completedAt,
          auditSummary: updated.auditSummary,
          responseData: updated.responseData,
          pdfS3Key: updated.pdfS3Key,
          lastPublicTokenAt: updated.lastPublicTokenAt,
          lastPublicTokenExpiresAt: updated.lastPublicTokenExpiresAt,
          updatedAt: updated.updatedAt,
          version: updated.version,
        })
        .where(eq(smartFiles.id, id));

      return {
        entityName: "smart_file",
        eventName: "updated",
        entityId: id,
        before: existing,
        after: updated,
        result: updated,
      };
    });
  }

  public async updateResponseData(id: string, responseData: Record<string, unknown>, context: MutationContext) {
    const existing = await this.getSmartFileById(id);
    if (!existing) {
      throw new Error(`Smart File ${id} was not found.`);
    }

    const nextStatus: SmartFileStatus = existing.status === "sent" ? "partially_completed" : existing.status;
    return this.updateSmartFileStatus(
      id,
      nextStatus,
      context,
      {
        responseData,
      },
    );
  }

  public async recordSignature(
    smartFileId: string,
    input: {
      readonly signatureMethod: SignatureMethod;
      readonly signatureName: string;
      readonly signatureSvg?: string | null;
      readonly signerIp?: string | null;
      readonly signerUserAgent?: string | null;
      readonly signerGeolocation?: Record<string, unknown>;
      readonly verificationPhone?: string | null;
      readonly verificationVerifiedAt?: Date | null;
      readonly renderedDocument: Record<string, unknown>;
    },
    context: MutationContext,
  ) {
    const smartFile = await this.getSmartFileById(smartFileId);
    if (!smartFile) {
      throw new Error(`Smart File ${smartFileId} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const documentHashAtSigning = createHash("sha256")
      .update(JSON.stringify(input.renderedDocument))
      .digest("hex");

    const signature = {
      id: createUuid(),
      smartFileId,
      signatureMethod: input.signatureMethod,
      signatureName: input.signatureName,
      signatureSvg: input.signatureSvg ?? null,
      signatureImageS3Key: null,
      signedAt: occurredAt,
      signerIp: input.signerIp ?? null,
      signerUserAgent: input.signerUserAgent ?? null,
      signerGeolocation: input.signerGeolocation ?? {},
      documentHashAtSigning,
      verificationPhone: input.verificationPhone ?? null,
      verificationVerifiedAt: input.verificationVerifiedAt ?? null,
      metadata: {},
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    await this.database.insert(smartFileSignatures).values(signature);

    await this.updateSmartFileStatus(
      smartFileId,
      "signed",
      context,
      {
        completedAt: occurredAt,
        auditSummary: {
          ...smartFile.auditSummary,
          signedAt: occurredAt.toISOString(),
          signatureMethod: input.signatureMethod,
          signatureName: input.signatureName,
          documentHashAtSigning,
        },
      },
    );

    return signature;
  }

  public async getLatestSignature(smartFileId: string) {
    const records = await this.database
      .select()
      .from(smartFileSignatures)
      .where(and(eq(smartFileSignatures.smartFileId, smartFileId), isNull(smartFileSignatures.deletedAt)))
      .orderBy(asc(smartFileSignatures.signedAt))
      .limit(100);

    return records.at(-1) ?? null;
  }

  public async buildSmartFieldContext(smartFileId: string): Promise<SmartFieldContext> {
    const smartFile = await this.getSmartFileById(smartFileId);
    if (!smartFile) {
      throw new Error(`Smart File ${smartFileId} was not found.`);
    }

    const [client, inquiry, session] = await Promise.all([
      smartFile.clientId ? this.clientsService.getClientById(smartFile.clientId) : Promise.resolve(null),
      smartFile.inquiryId ? this.inquiriesService.getInquiryById(smartFile.inquiryId) : Promise.resolve(null),
      smartFile.sessionId ? this.sessionsService.getSessionById(smartFile.sessionId) : Promise.resolve(null),
    ]);

    return {
      client,
      inquiry,
      session,
      smartFile,
    };
  }

  public resolveBlocks(blocks: SmartFileBlock[], context: SmartFieldContext, responseData: Record<string, unknown>): ResolvedSmartFileBlock[] {
    const flattened = flattenContext(context);
    const replaceFields = (value: string | null | undefined): string | null => {
      if (!value) {
        return value ?? null;
      }

      return value.replace(/\{\{\s*([^}]+)\s*\}\}/g, (_match, token: string) => {
        const trimmedToken = token.trim();
        if (trimmedToken.startsWith("request:")) {
          const requestField = trimmedToken.slice("request:".length);
          const candidate = responseData[requestField];
          return candidate === undefined || candidate === null ? `{{${trimmedToken}}}` : `${candidate}`;
        }

        const resolved = getPathValue(flattened, trimmedToken);
        return resolved === undefined || resolved === null ? "" : `${resolved}`;
      });
    };

    return blocks
      .slice()
      .sort((left, right) => left.order - right.order)
      .map((block) => ({
        ...block,
        title: replaceFields(block.title),
        content: replaceFields(block.content),
        renderedContent: replaceFields(block.content),
      }));
  }
}
