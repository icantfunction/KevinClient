// Stage 6 Galleries Service Purpose
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { galleries, type GalleryStatus } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateGalleryInput = {
  readonly sessionId?: string | null;
  readonly slug: string;
  readonly title: string;
  readonly description?: string | null;
  readonly expectedPhotoCount?: number;
  readonly expiresAt?: Date | null;
  readonly downloadPin?: string | null;
  readonly watermarkEnabled?: boolean;
  readonly aiTaggingEnabled?: boolean;
  readonly clientCanFavorite?: boolean;
  readonly clientCanDownload?: boolean;
  readonly clientCanShare?: boolean;
  readonly printStoreEnabled?: boolean;
};

export class GalleriesService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createGallery(input: CreateGalleryInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const inserted: typeof galleries.$inferInsert = {
      id: createUuid(),
      slug: input.slug,
      title: input.title,
      status: "processing" as GalleryStatus,
      expectedPhotoCount: input.expectedPhotoCount ?? 0,
      processedPhotoCount: 0,
      watermarkEnabled: input.watermarkEnabled ?? false,
      aiTaggingEnabled: input.aiTaggingEnabled ?? false,
      clientCanFavorite: input.clientCanFavorite ?? true,
      clientCanDownload: input.clientCanDownload ?? true,
      clientCanShare: input.clientCanShare ?? true,
      printStoreEnabled: input.printStoreEnabled ?? false,
      viewCount: 0,
      uniqueVisitorCount: 0,
      createdAt: occurredAt,
      updatedAt: occurredAt,
      version: 1,
    };

    if (input.sessionId) {
      inserted.sessionId = input.sessionId;
    }

    if (input.description) {
      inserted.description = input.description;
    }

    if (input.expiresAt) {
      inserted.expiresAt = input.expiresAt;
    }

    if (input.downloadPin) {
      inserted.downloadPin = input.downloadPin;
    }

    await this.database.insert(galleries).values(inserted);

    return this.recordMutation(context, {
      entityName: "gallery",
      eventName: "created",
      entityId: inserted.id,
      before: null,
      after: inserted,
      result: inserted,
    });
  }

  public async getGalleryById(id: string) {
    const rows = await this.database
      .select()
      .from(galleries)
      .where(and(eq(galleries.id, id), isNull(galleries.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }

  public async getGalleryBySlug(slug: string) {
    const rows = await this.database
      .select()
      .from(galleries)
      .where(and(eq(galleries.slug, slug), isNull(galleries.deletedAt)))
      .limit(1);

    return rows[0] ?? null;
  }

  public async listGalleries(input: {
    readonly status?: GalleryStatus;
    readonly expiresBefore?: Date;
  } = {}) {
    return this.database
      .select()
      .from(galleries)
      .where(
        and(
          isNull(galleries.deletedAt),
          input.status ? eq(galleries.status, input.status) : undefined,
          input.expiresBefore ? sql`${galleries.expiresAt} <= ${input.expiresBefore}` : undefined,
        ),
      )
      .orderBy(asc(galleries.createdAt));
  }

  public async updateGallery(id: string, updates: Partial<typeof galleries.$inferSelect>, context: MutationContext) {
    const existing = await this.getGalleryById(id);
    if (!existing) {
      throw new Error(`Gallery ${id} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const updated = {
      ...existing,
      ...updates,
      updatedAt: occurredAt,
      version: existing.version + 1,
    };

    await this.database
      .update(galleries)
      .set({
        coverPhotoId: updated.coverPhotoId,
        status: updated.status,
        processedPhotoCount: updated.processedPhotoCount,
        deliveredAt: updated.deliveredAt,
        expiresAt: updated.expiresAt,
        lastViewedAt: updated.lastViewedAt,
        viewCount: updated.viewCount,
        uniqueVisitorCount: updated.uniqueVisitorCount,
        updatedAt: updated.updatedAt,
        version: updated.version,
      })
      .where(eq(galleries.id, id));

    return this.recordMutation(context, {
      entityName: "gallery",
      eventName: "updated",
      entityId: id,
      before: existing,
      after: updated,
      result: updated,
    });
  }

  public async recordPhotoProcessed(id: string, context: MutationContext) {
    const existing = await this.getGalleryById(id);
    if (!existing) {
      throw new Error(`Gallery ${id} was not found.`);
    }

    const occurredAt = context.occurredAt ?? new Date();
    const rows = await this.database
      .update(galleries)
      .set({
        processedPhotoCount: sql<number>`${galleries.processedPhotoCount} + 1`,
        status: sql<GalleryStatus>`case
          when ${galleries.expectedPhotoCount} > 0
            and ${galleries.processedPhotoCount} + 1 >= ${galleries.expectedPhotoCount}
          then 'ready'
          else ${galleries.status}
        end`,
        updatedAt: occurredAt,
        version: sql<number>`${galleries.version} + 1`,
      })
      .where(and(eq(galleries.id, id), isNull(galleries.deletedAt)))
      .returning();

    const updated = rows[0];
    if (!updated) {
      throw new Error(`Gallery ${id} was not found.`);
    }

    return this.recordMutation(context, {
      entityName: "gallery",
      eventName: "updated",
      entityId: id,
      before: existing,
      after: updated,
      result: updated,
    });
  }

  public async recordView(id: string, context: MutationContext) {
    const gallery = await this.getGalleryById(id);
    if (!gallery) {
      throw new Error(`Gallery ${id} was not found.`);
    }

    return this.updateGallery(
      id,
      {
        viewCount: gallery.viewCount + 1,
        uniqueVisitorCount: gallery.uniqueVisitorCount + 1,
        lastViewedAt: context.occurredAt ?? new Date(),
      },
      context,
    );
  }
}
