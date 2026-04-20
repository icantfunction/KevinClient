// Stage 8 Expense Receipt Scan Get Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const scanId = event.pathParameters?.id;
  if (!scanId) {
    return jsonResponse(400, { error: "receipt scan id is required." });
  }

  const { expenseReceiptScansService } = createStage3Services();
  const scan = await expenseReceiptScansService.getScanById(scanId);
  if (!scan) {
    return jsonResponse(404, { error: "receipt scan not found." });
  }

  return jsonResponse(200, { scan });
};
