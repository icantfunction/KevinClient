// Stage 6 Gallery List Lambda Purpose
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse } from "../shared/http";

export const handler = async (_event: APIGatewayProxyEventV2) => {
  const { galleriesService } = createStage3Services();
  const galleries = await galleriesService.listGalleries();
  return jsonResponse(200, { galleries });
};
