// Stage 5 Public Smart File Verification Request Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";
import { verifySmartFilePublicToken } from "../shared/smart-file-public-token";
import { issueSmartFileVerificationCode } from "../shared/smart-file-verification";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const token = event.pathParameters?.token;
  if (!token) {
    return jsonResponse(400, { error: "Smart File token is required." });
  }

  try {
    const { smartFileId } = await verifySmartFilePublicToken(token);
    const { smartFilesService } = createStage3Services();
    const smartFile = await smartFilesService.getSmartFileById(smartFileId);
    if (!smartFile) {
      return jsonResponse(404, { error: "smart file not found." });
    }

    if (!smartFile.recipientPhone) {
      return jsonResponse(400, { error: "Smart File does not have a recipient phone for verification." });
    }

    const result = await issueSmartFileVerificationCode(smartFile.id, smartFile.recipientPhone);
    return jsonResponse(200, {
      verificationRequested: true,
      expiresAt: result.expiresAt.toISOString(),
    });
  } catch (error) {
    return jsonResponse(401, { error: error instanceof Error ? error.message : "Invalid Smart File token." });
  }
};
