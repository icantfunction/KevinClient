// Stage 1 OTP Auth Shared Helpers Purpose
import { createHash, timingSafeEqual } from "node:crypto";
import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";

const secretsClient = new SecretsManagerClient({});

let cachedSalt: string | undefined;

const readRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const getAllowedPhoneNumber = (): string => readRequiredEnv("ALLOWED_PHONE_NUMBER");

export const getPhoneHashSalt = async (): Promise<string> => {
  if (cachedSalt) {
    return cachedSalt;
  }

  const secretArn = readRequiredEnv("PHONE_HASH_SALT_SECRET_ARN");
  const response = await secretsClient.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    }),
  );

  if (!response.SecretString) {
    throw new Error(`Secret ${secretArn} did not contain a SecretString payload.`);
  }

  const parsed = JSON.parse(response.SecretString) as { phoneHashSalt?: string };
  if (!parsed.phoneHashSalt) {
    throw new Error(`Secret ${secretArn} did not contain a phoneHashSalt field.`);
  }

  cachedSalt = parsed.phoneHashSalt;
  return cachedSalt;
};

export const hashPhoneNumber = async (phoneNumber: string): Promise<string> => {
  const salt = await getPhoneHashSalt();
  return createHash("sha256").update(`${salt}:${phoneNumber}`).digest("hex");
};

export const hashOtpCode = async (phoneHash: string, otpCode: string): Promise<string> => {
  const salt = await getPhoneHashSalt();
  return createHash("sha256").update(`${salt}:${phoneHash}:${otpCode}`).digest("hex");
};

export const safeOtpEquals = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

export const normalizePhoneNumber = (value: string | undefined): string => {
  if (!value) {
    return "";
  }

  return value.trim();
};

export const createOtpCode = (): string => `${Math.floor(100000 + Math.random() * 900000)}`;

export const logPhoneEvent = (eventName: string, details: Record<string, unknown>): void => {
  console.log(
    JSON.stringify({
      event: eventName,
      ...details,
    }),
  );
};
