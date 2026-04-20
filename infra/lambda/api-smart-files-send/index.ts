// Stage 5 Smart File Send Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";
import { sendSmartFileWorkflow } from "../shared/smart-file-send-workflow";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const smartFileId = event.pathParameters?.id;
  if (!smartFileId) {
    return jsonResponse(400, { error: "smart file id is required." });
  }

  const { activitiesService, smartFilesService } = createStage3Services();
  const smartFile = await smartFilesService.getSmartFileById(smartFileId);
  if (!smartFile) {
    return jsonResponse(404, { error: "smart file not found." });
  }

  const result = await sendSmartFileWorkflow({
    smartFileId,
    smartFilesService,
    activitiesService,
    actor: "kevin",
    occurredAt: new Date(),
  });

  return jsonResponse(200, {
    smartFile: result.smartFile,
    signUrl: result.signUrl,
    deliveryStatus: result.deliveryStatus,
    deliveryError: result.deliveryError,
  });
};
