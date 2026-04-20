// Stage 4 Dashboard Summary Lambda Purpose
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async () => {
  const { sessionsService } = createStage3Services();
  const summary = await sessionsService.getDashboardSummary(new Date());
  return jsonResponse(200, summary as Record<string, unknown>);
};
