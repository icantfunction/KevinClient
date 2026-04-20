// Stage 3 Inquiries Service Purpose
import { and, desc, eq, isNull } from "drizzle-orm";
import type { StudioOsDatabase } from "../client";
import { inquiries, type InquiryEventType, type InquiryMetadata, type InquiryStatus } from "../schema";
import { createUuid } from "../utils/uuid";
import { BaseDomainService, type MutationContext } from "./base-service";

export type CreateInquiryInput = {
  readonly inquirerName: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly eventType: InquiryEventType;
  readonly eventDate?: Date | null;
  readonly eventLocation?: string | null;
  readonly estimatedGuestCount?: number | null;
  readonly budgetRange?: string | null;
  readonly referralSource?: string | null;
  readonly message?: string | null;
  readonly status?: InquiryStatus;
  readonly lostReason?: string | null;
  readonly assignedSmartFileId?: string | null;
  readonly notes?: string | null;
  readonly metadata?: InquiryMetadata;
};

export type ListInquiriesFilters = {
  readonly status?: InquiryStatus;
  readonly limit?: number;
};

export class InquiriesService extends BaseDomainService {
  public constructor(database: StudioOsDatabase) {
    super(database);
  }

  public async createInquiry(input: CreateInquiryInput, context: MutationContext) {
    const occurredAt = context.occurredAt ?? new Date();
    const inserted = {
      id: createUuid(),
      inquirerName: input.inquirerName,
      email: input.email ?? null,
      phone: input.phone ?? null,
      eventType: input.eventType,
      eventDate: input.eventDate ?? null,
      eventLocation: input.eventLocation ?? null,
      estimatedGuestCount: input.estimatedGuestCount ?? null,
      budgetRange: input.budgetRange ?? null,
      referralSource: input.referralSource ?? null,
      message: input.message ?? null,
      status: input.status ?? "new",
      lostReason: input.lostReason ?? null,
      assignedSmartFileId: input.assignedSmartFileId ?? null,
      notes: input.notes ?? null,
      metadata: input.metadata ?? {},
      createdAt: occurredAt,
      updatedAt: occurredAt,
      deletedAt: null,
      version: 1,
    };

    await this.database.insert(inquiries).values(inserted);

    return this.recordMutation(context, {
      entityName: "inquiry",
      eventName: "created",
      entityId: inserted.id,
      before: null,
      after: inserted,
      result: inserted,
    });
  }

  public async getInquiryById(id: string) {
    const records = await this.database
      .select()
      .from(inquiries)
      .where(and(eq(inquiries.id, id), isNull(inquiries.deletedAt)))
      .limit(1);

    return records[0] ?? null;
  }

  public async listInquiries(filters: ListInquiriesFilters = {}) {
    const limit = Math.min(filters.limit ?? 50, 100);

    return this.database
      .select()
      .from(inquiries)
      .where(
        and(
          isNull(inquiries.deletedAt),
          filters.status ? eq(inquiries.status, filters.status) : undefined,
        ),
      )
      .orderBy(desc(inquiries.createdAt))
      .limit(limit);
  }
}
