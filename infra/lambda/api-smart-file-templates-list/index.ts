// Stage 5 Smart File Template List Lambda Purpose
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async () => {
  const { smartFileTemplatesService } = createStage3Services();
  const templates = await smartFileTemplatesService.listTemplates();
  return jsonResponse(200, { templates });
};
