// Stage 3 Inquiry List Lambda Purpose
import { inquiryStatuses } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const status = event.queryStringParameters?.status;
  const limitValue = event.queryStringParameters?.limit;
  const limit = limitValue ? Number(limitValue) : undefined;

  if (status && !inquiryStatuses.includes(status as (typeof inquiryStatuses)[number])) {
    return jsonResponse(400, {
      error: "status is invalid.",
    });
  }

  const { inquiriesService } = createStage3Services();
  const inquiries = await inquiriesService.listInquiries({
    status: status as (typeof inquiryStatuses)[number] | undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return jsonResponse(200, {
    inquiries,
  });
};
