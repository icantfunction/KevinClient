// Stage 5 Smart File Templates Service Purpose
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { smartFileTemplates, smartFileTemplateVersions, type SmartFileBlock } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateSmartFileTemplateInput = {
  readonly name: string;
  readonly category: string;
  readonly description?: string | null;
  readonly title: string;
  readonly blocks: SmartFileBlock[];
  readonly metadata?: Record<string, unknown>;
};

export type CreateSmartFileTemplateVersionInput = {
  readonly templateId: string;
  readonly title: string;
  readonly description?: string | null;
  readonly blocks: SmartFileBlock[];
  readonly metadata?: Record<string, unknown>;
};

export class SmartFileTemplatesService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createTemplate(input: CreateSmartFileTemplateInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const template = {
      id: createUuid(),
      name: input.name,
      category: input.category,
      description: input.description ?? null,
      active: true,
      latestVersionNumber: 1,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    await this.database.insert(smartFileTemplates).values(template);

    const templateVersion = {
      id: createUuid(),
      templateId: template.id,
      versionNumber: 1,
      title: input.title,
      description: input.description ?? null,
      blocks: input.blocks,
      metadata: input.metadata ?? {},
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    await this.database.insert(smartFileTemplateVersions).values(templateVersion);

    return this.recordMutation(context, {
      entityName: "smart_file_template",
      eventName: "created",
      entityId: template.id,
      before: null,
      after: {
        ...template,
        initialVersionId: templateVersion.id,
      },
      result: {
        ...template,
        latestVersion: templateVersion,
      },
    });
  }

  public async createTemplateVersion(input: CreateSmartFileTemplateVersionInput, context: MutationContext) {
    const template = await this.getTemplateById(input.templateId);
    if (!template) {
      throw new Error(`Smart File template ${input.templateId} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const nextVersionNumber = template.latestVersionNumber + 1;
    const version = {
      id: createUuid(),
      templateId: template.id,
      versionNumber: nextVersionNumber,
      title: input.title,
      description: input.description ?? null,
      blocks: input.blocks,
      metadata: input.metadata ?? {},
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    await this.database.insert(smartFileTemplateVersions).values(version);
    await this.database
      .update(smartFileTemplates)
      .set({
        latestVersionNumber: nextVersionNumber,
        updatedAt: occurredAt,
        version: template.version + 1,
      })
      .where(eq(smartFileTemplates.id, template.id));

    const updatedTemplate = {
      ...template,
      latestVersionNumber: nextVersionNumber,
      updatedAt: occurredAt,
      version: template.version + 1,
    };

    return this.recordMutation(context, {
      entityName: "smart_file_template",
      eventName: "version_created",
      entityId: template.id,
      before: template,
      after: updatedTemplate,
      result: updatedTemplate,
    });
  }

  public async getTemplateById(id: string) {
    const records = await this.database
      .select()
      .from(smartFileTemplates)
      .where(and(eq(smartFileTemplates.id, id), isNull(smartFileTemplates.deletedAt)))
      .limit(1);

    return records[0] ?? null;
  }

  public async getLatestTemplateVersion(templateId: string) {
    const versions = await this.database
      .select()
      .from(smartFileTemplateVersions)
      .where(and(eq(smartFileTemplateVersions.templateId, templateId), isNull(smartFileTemplateVersions.deletedAt)))
      .orderBy(desc(smartFileTemplateVersions.versionNumber))
      .limit(1);

    return versions[0] ?? null;
  }

  public async listTemplates() {
    return this.database
      .select()
      .from(smartFileTemplates)
      .where(isNull(smartFileTemplates.deletedAt))
      .orderBy(asc(smartFileTemplates.name));
  }
}
