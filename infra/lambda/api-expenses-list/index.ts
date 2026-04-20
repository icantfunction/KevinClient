// Stage 8 Expenses List Lambda Purpose
import { expenseCategories } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const category = event.queryStringParameters?.category;
  if (category && !expenseCategories.includes(category as never)) {
    return jsonResponse(400, { error: "category is invalid." });
  }

  const limitValue = event.queryStringParameters?.limit;
  const limit = limitValue ? Number(limitValue) : undefined;
  const { expensesService } = createStage3Services();
  const expenses = await expensesService.listExpenses({
    category: category as (typeof expenseCategories)[number] | undefined,
    from: event.queryStringParameters?.from ? new Date(event.queryStringParameters.from) : undefined,
    to: event.queryStringParameters?.to ? new Date(event.queryStringParameters.to) : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return jsonResponse(200, { expenses });
};
