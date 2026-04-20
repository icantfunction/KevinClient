// Stage 3 Lambda Idempotency Helpers Purpose
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DeleteCommand,
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import type { APIGatewayProxyStructuredResultV2 } from "aws-lambda";

type IdempotencyRecord = {
  readonly idempotency_key: string;
  readonly status: "IN_PROGRESS" | "COMPLETED";
  readonly expires_at: number;
  readonly response_status_code?: number;
  readonly response_headers?: Record<string, string>;
  readonly response_body?: string;
};

const tableName = process.env.STUDIO_OS_IDEMPOTENCY_TABLE_NAME;

if (!tableName) {
  throw new Error("Missing required environment variable: STUDIO_OS_IDEMPOTENCY_TABLE_NAME");
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const toCachedResponse = (record: IdempotencyRecord): APIGatewayProxyStructuredResultV2 | null => {
  if (record.status !== "COMPLETED" || !record.response_status_code || record.response_body === undefined) {
    return null;
  }

  return {
    statusCode: record.response_status_code,
    headers: record.response_headers ?? {
      "content-type": "application/json",
    },
    body: record.response_body,
  };
};

export const beginIdempotentRequest = async (
  key: string,
): Promise<{ readonly status: "acquired" } | { readonly status: "cached"; readonly response: APIGatewayProxyStructuredResultV2 }> => {
  const expiresAt = Math.floor(Date.now() / 1000) + 24 * 60 * 60;

  try {
    await documentClient.send(
      new PutCommand({
        TableName: tableName,
        Item: {
          idempotency_key: key,
          status: "IN_PROGRESS",
          expires_at: expiresAt,
        },
        ConditionExpression: "attribute_not_exists(idempotency_key)",
      }),
    );

    return { status: "acquired" };
  } catch (error) {
    if (!(error instanceof Error) || error.name !== "ConditionalCheckFailedException") {
      throw error;
    }

    const existing = await documentClient.send(
      new GetCommand({
        TableName: tableName,
        Key: {
          idempotency_key: key,
        },
      }),
    );

    const item = existing.Item as IdempotencyRecord | undefined;
    const cachedResponse = item ? toCachedResponse(item) : null;

    if (cachedResponse) {
      return {
        status: "cached",
        response: cachedResponse,
      };
    }

    throw new Error("A matching idempotent request is already in progress.");
  }
};

export const completeIdempotentRequest = async (
  key: string,
  response: APIGatewayProxyStructuredResultV2,
): Promise<void> => {
  await documentClient.send(
    new UpdateCommand({
      TableName: tableName,
      Key: {
        idempotency_key: key,
      },
      UpdateExpression:
        "SET #status = :status, response_status_code = :statusCode, response_headers = :headers, response_body = :body",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": "COMPLETED",
        ":statusCode": response.statusCode ?? 200,
        ":headers": response.headers ?? { "content-type": "application/json" },
        ":body": response.body ?? "",
      },
    }),
  );
};

export const abandonIdempotentRequest = async (key: string): Promise<void> => {
  await documentClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        idempotency_key: key,
      },
    }),
  );
};
