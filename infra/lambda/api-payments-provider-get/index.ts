// Stage 11 Payment Provider Config Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createPaymentProvider } from "../shared/payments";
import { jsonResponse } from "../shared/http";

export const handler = async (_event: APIGatewayProxyEventV2) => {
  const provider = await createPaymentProvider();
  const configuration = await provider.getConfiguration();
  return jsonResponse(200, { configuration });
};
