// Stage 3 Inquiry Create Lambda Purpose
import { inquiryEventTypes, type InquiryEventType } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { abandonIdempotentRequest, beginIdempotentRequest, completeIdempotentRequest } from "../shared/idempotency";
import { getHeader, jsonResponse, parseJsonBody } from "../shared/http";

type CreateInquiryRequest = {
  readonly inquirerName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly eventType?: string;
  readonly eventDate?: string | null;
  readonly eventLocation?: string | null;
  readonly estimatedGuestCount?: number | null;
  readonly budgetRange?: string | null;
  readonly referralSource?: string | null;
  readonly message?: string | null;
  readonly notes?: string | null;
};

const isValidEventType = (eventType: string): boolean =>
  inquiryEventTypes.includes(eventType as (typeof inquiryEventTypes)[number]);

export const handler = async (event: APIGatewayProxyEventV2) => {
  const idempotencyHeader = getHeader(event, "Idempotency-Key");

  if (!idempotencyHeader) {
    return jsonResponse(400, {
      error: "Missing Idempotency-Key header.",
    });
  }

  const idempotencyKey = `POST:/inquiries:${idempotencyHeader}`;
  const operation = await beginIdempotentRequest(idempotencyKey);

  if (operation.status === "cached") {
    return operation.response;
  }

  try {
    const payload = parseJsonBody<CreateInquiryRequest>(event);

    if (!payload.inquirerName?.trim()) {
      return jsonResponse(400, {
        error: "inquirerName is required.",
      });
    }

    if (!payload.eventType || !isValidEventType(payload.eventType)) {
      return jsonResponse(400, {
        error: "eventType is invalid.",
      });
    }

    const { activitiesService, clientsService, inquiriesService } = createStage3Services();
    const occurredAt = new Date();
    const matchedClient = await clientsService.findClientByContact(payload.email ?? null, payload.phone ?? null);
    const inquiry = await inquiriesService.createInquiry(
      {
        inquirerName: payload.inquirerName.trim(),
        email: payload.email?.trim() || null,
        phone: payload.phone?.trim() || null,
        eventType: payload.eventType as InquiryEventType,
        eventDate: payload.eventDate ? new Date(payload.eventDate) : null,
        eventLocation: payload.eventLocation?.trim() || null,
        estimatedGuestCount: payload.estimatedGuestCount ?? null,
        budgetRange: payload.budgetRange?.trim() || null,
        referralSource: payload.referralSource?.trim() || null,
        message: payload.message?.trim() || null,
        notes: payload.notes?.trim() || null,
        metadata: {
          source: "public_form",
          ip: event.requestContext.http.sourceIp,
          userAgent: getHeader(event, "user-agent") ?? null,
        },
      },
      {
        actor: "client:inquiry",
        occurredAt,
      },
    );

    await activitiesService.createActivity(
      {
        clientId: matchedClient?.id ?? null,
        scopeType: "inquiry",
        scopeId: inquiry.id,
        channel: "system",
        direction: "inbound",
        activityType: "inquiry.received",
        subject: `New ${payload.eventType} inquiry`,
        body: payload.message?.trim() || null,
        occurredAt,
        metadata: {
          inquiryId: inquiry.id,
          source: "public_form",
          ip: event.requestContext.http.sourceIp,
        },
      },
      {
        actor: "client:inquiry",
        occurredAt,
      },
    );

    const response = jsonResponse(201, {
      inquiry,
      matchedClientId: matchedClient?.id ?? null,
    });

    await completeIdempotentRequest(idempotencyKey, response);
    return response;
  } catch (error) {
    await abandonIdempotentRequest(idempotencyKey);
    const message = error instanceof Error ? error.message : "Unexpected error.";
    return jsonResponse(500, {
      error: message,
    });
  }
};
