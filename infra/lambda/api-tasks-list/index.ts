// Stage 10 Tasks List Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

type TaskScope = "standalone" | "session" | "studio_booking" | "admin";
type TaskStatus = "todo" | "doing" | "waiting_client" | "waiting_vendor" | "blocked" | "done";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const { tasksService } = createStage3Services();
  const limit = event.queryStringParameters?.limit ? Number(event.queryStringParameters.limit) : undefined;
  const tasks = await tasksService.listTasks({
    scope: event.queryStringParameters?.scope as TaskScope | undefined,
    scopeId: event.queryStringParameters?.scope_id,
    status: event.queryStringParameters?.status as TaskStatus | undefined,
    includeDone: event.queryStringParameters?.include_done === "true",
    from: event.queryStringParameters?.from ? new Date(event.queryStringParameters.from) : undefined,
    to: event.queryStringParameters?.to ? new Date(event.queryStringParameters.to) : undefined,
    limit: Number.isFinite(limit) ? limit : undefined,
  });

  return jsonResponse(200, { tasks });
};
