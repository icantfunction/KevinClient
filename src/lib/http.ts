type JsonRecord = Record<string, unknown>;

const isJsonRecord = (value: unknown): value is JsonRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const extractNestedMessage = (value: unknown): string | null => {
  if (!isJsonRecord(value)) {
    return null;
  }

  const nestedError = value.error;
  if (typeof nestedError === "string" && nestedError.trim()) {
    return nestedError;
  }

  if (isJsonRecord(nestedError) && typeof nestedError.message === "string") {
    return nestedError.message;
  }

  return null;
};

export const getResponseErrorMessage = (
  payload: unknown,
  fallbackMessage: string,
): string => {
  if (!isJsonRecord(payload)) {
    return extractNestedMessage(payload) ?? fallbackMessage;
  }

  for (const key of ["message", "Message", "detail", "reason"]) {
    const candidate = payload[key];
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate;
    }
  }

  return extractNestedMessage(payload) ?? fallbackMessage;
};

export async function readJsonResponse<T>(
  response: Response,
  fallbackMessage: string,
): Promise<T> {
  const rawText = await response.text();
  let payload: unknown = {};

  if (rawText.trim()) {
    try {
      payload = JSON.parse(rawText) as unknown;
    } catch {
      if (!response.ok) {
        throw new Error(`${fallbackMessage} (${response.status})`);
      }

      throw new Error("Received an invalid server response.");
    }
  }

  if (!response.ok) {
    throw new Error(
      getResponseErrorMessage(
        payload,
        `${fallbackMessage} (${response.status})`,
      ),
    );
  }

  return payload as T;
}
