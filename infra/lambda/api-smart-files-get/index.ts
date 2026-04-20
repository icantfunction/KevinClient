// Stage 5 Smart File Get Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const smartFileId = event.pathParameters?.id;
  if (!smartFileId) {
    return jsonResponse(400, { error: "smart file id is required." });
  }

  const { smartFilesService } = createStage3Services();
  const smartFile = await smartFilesService.getSmartFileById(smartFileId);
  if (!smartFile) {
    return jsonResponse(404, { error: "smart file not found." });
  }

  const signature = await smartFilesService.getLatestSignature(smartFileId);
  return jsonResponse(200, { smartFile, signature });
};
