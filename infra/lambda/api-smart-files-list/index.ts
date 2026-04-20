// Stage 5 Smart File List Lambda Purpose
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async () => {
  const { smartFilesService } = createStage3Services();
  const smartFiles = await smartFilesService.listSmartFiles();
  return jsonResponse(200, { smartFiles });
};
