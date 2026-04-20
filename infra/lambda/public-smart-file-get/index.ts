// Stage 5 Public Smart File Get Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { verifySmartFilePublicToken } from "../shared/smart-file-public-token";
import { jsonResponse } from "../shared/http";
import { createPaymentProvider } from "../shared/payments";
import { listPayableInvoicesForSmartFile } from "../shared/smart-file-payments";

export const handler = async (event: APIGatewayProxyEventV2) => {
  const token = event.pathParameters?.token;
  if (!token) {
    return jsonResponse(400, { error: "Smart File token is required." });
  }

  try {
    const { smartFileId } = await verifySmartFilePublicToken(token);
    const { invoicesService, sessionsService, smartFilesService } = createStage3Services();
    const smartFile = await smartFilesService.getSmartFileById(smartFileId);
    if (!smartFile) {
      return jsonResponse(404, { error: "smart file not found." });
    }

    const context = await smartFilesService.buildSmartFieldContext(smartFileId);
    const resolvedBlocks = smartFilesService.resolveBlocks(smartFile.snapshotBlocks, context, smartFile.responseData);
    const paymentProvider = await (await createPaymentProvider()).getConfiguration();
    const payableInvoices = await listPayableInvoicesForSmartFile({
      smartFileId,
      smartFilesService,
      invoicesService,
      sessionsService,
    });
    if (smartFile.status === "sent") {
      await smartFilesService.updateSmartFileStatus(
        smartFile.id,
        "viewed",
        { actor: "client:smart_file", occurredAt: new Date() },
        { viewedAt: new Date() },
      );
    }

    return jsonResponse(200, {
      smartFile: {
        id: smartFile.id,
        title: smartFile.title,
        status: smartFile.status,
        expiresAt: smartFile.expiresAt,
      },
      resolvedBlocks,
      responseData: smartFile.responseData,
      paymentProvider,
      payableInvoices,
    });
  } catch (error) {
    return jsonResponse(401, { error: error instanceof Error ? error.message : "Invalid Smart File token." });
  }
};
