// Stage 3 Lambda HTTP Helpers Purpose
import type { APIGatewayProxyEventV2, APIGatewayProxyStructuredResultV2 } from "aws-lambda";

export const jsonResponse = (
  statusCode: number,
  body: Record<string, unknown>,
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify(body),
});

export const textResponse = (
  statusCode: number,
  body: string,
  contentType = "text/plain; charset=utf-8",
): APIGatewayProxyStructuredResultV2 => ({
  statusCode,
  headers: {
    "content-type": contentType,
  },
  body,
});

export const parseJsonBody = <T>(event: APIGatewayProxyEventV2): T => {
  if (!event.body) {
    throw new Error("Request body is required.");
  }

  return JSON.parse(event.body) as T;
};

export const getHeader = (event: APIGatewayProxyEventV2, name: string): string | undefined => {
  const expected = name.toLowerCase();
  const entry = Object.entries(event.headers ?? {}).find(([key]) => key.toLowerCase() === expected);
  return entry?.[1];
};
