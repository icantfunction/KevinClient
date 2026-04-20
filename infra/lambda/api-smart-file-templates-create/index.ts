// Stage 5 Smart File Template Create Lambda Purpose
import { smartFileBlockTypes, type SmartFileBlock, type SmartFileBlockType } from "@studio-os/database";
import type { APIGatewayProxyEventV2 } from "aws-lambda";
import { createStage3Services } from "../shared/database";
import { jsonResponse, parseJsonBody } from "../shared/http";

type CreateTemplateRequest = {
  readonly name?: string;
  readonly category?: string;
  readonly description?: string | null;
  readonly title?: string;
  readonly blocks?: SmartFileBlock[];
};

const isValidBlock = (block: SmartFileBlock) => smartFileBlockTypes.includes(block.type as SmartFileBlockType);

export const handler = async (event: APIGatewayProxyEventV2) => {
  const payload = parseJsonBody<CreateTemplateRequest>(event);
  if (!payload.name?.trim() || !payload.category?.trim() || !payload.title?.trim() || !Array.isArray(payload.blocks)) {
    return jsonResponse(400, { error: "name, category, title, and blocks are required." });
  }

  if (payload.blocks.some((block) => !isValidBlock(block))) {
    return jsonResponse(400, { error: "One or more block types are invalid." });
  }

  const { smartFileTemplatesService } = createStage3Services();
  const template = await smartFileTemplatesService.createTemplate(
    {
      name: payload.name.trim(),
      category: payload.category.trim(),
      description: payload.description?.trim() || null,
      title: payload.title.trim(),
      blocks: payload.blocks,
    },
    { actor: "kevin", occurredAt: new Date() },
  );

  return jsonResponse(201, { template });
};
