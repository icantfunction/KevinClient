// Stage 5 Smart File Verification Helpers Purpose
import { createHash, timingSafeEqual } from "node:crypto";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { loadSmartFileVerificationSalt } from "./smart-file-public-token";

type VerificationRecord = {
  readonly verification_key: string;
  readonly code_hash: string;
  readonly expires_at: number;
};

const tableName = process.env.STUDIO_OS_SMART_FILE_VERIFICATION_TABLE_NAME;

if (!tableName) {
  throw new Error("Missing required environment variable: STUDIO_OS_SMART_FILE_VERIFICATION_TABLE_NAME");
}

const documentClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const snsClient = new SNSClient({});

const createCode = () => `${Math.floor(100000 + Math.random() * 900000)}`;
const buildKey = (smartFileId: string, phone: string) => `${smartFileId}#${phone}`;

const hashCode = (salt: string, code: string) => createHash("sha256").update(`${salt}:${code}`).digest("hex");

const storeVerificationCode = async (smartFileId: string, phone: string, code: string) => {
  const salt = await loadSmartFileVerificationSalt();
  const expiresAt = Math.floor(Date.now() / 1000) + 5 * 60;

  await documentClient.send(
    new PutCommand({
      TableName: tableName,
      Item: {
        verification_key: buildKey(smartFileId, phone),
        code_hash: hashCode(salt, code),
        expires_at: expiresAt,
      } satisfies VerificationRecord,
    }),
  );

  return {
    expiresAt: new Date(expiresAt * 1000),
    code,
  };
};

export const issueSmartFileVerificationCode = async (smartFileId: string, phone: string) => {
  const code = createCode();
  const stored = await storeVerificationCode(smartFileId, phone, code);

  await snsClient.send(
    new PublishCommand({
      PhoneNumber: phone,
      Message: `Kevin's Studio OS signing code: ${code}`,
    }),
  );

  return {
    expiresAt: stored.expiresAt,
  };
};

export const seedSmartFileVerificationCodeForTesting = async (smartFileId: string, phone: string, code: string) => {
  if ((process.env.STAGE_NAME ?? "").toLowerCase() === "production") {
    throw new Error("seedSmartFileVerificationCodeForTesting is disabled in production.");
  }

  return storeVerificationCode(smartFileId, phone, code);
};

export const verifySmartFileVerificationCode = async (smartFileId: string, phone: string, code: string) => {
  const response = await documentClient.send(
    new GetCommand({
      TableName: tableName,
      Key: {
        verification_key: buildKey(smartFileId, phone),
      },
    }),
  );

  const record = response.Item as VerificationRecord | undefined;
  if (!record) {
    throw new Error("Verification code was not found.");
  }

  const salt = await loadSmartFileVerificationSalt();
  const expected = Buffer.from(record.code_hash);
  const actual = Buffer.from(hashCode(salt, code));
  const isValid = expected.length === actual.length && timingSafeEqual(expected, actual);

  if (!isValid) {
    throw new Error("Verification code is invalid.");
  }

  await documentClient.send(
    new DeleteCommand({
      TableName: tableName,
      Key: {
        verification_key: buildKey(smartFileId, phone),
      },
    }),
  );

  return true;
};
