// Stage 1 Verify Auth Challenge Lambda Purpose
import type { VerifyAuthChallengeResponseTriggerEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand, GetCommand } from "@aws-sdk/lib-dynamodb";
import {
  getAllowedPhoneNumber,
  hashOtpCode,
  hashPhoneNumber,
  logPhoneEvent,
  normalizePhoneNumber,
  safeOtpEquals,
} from "../shared/otp-auth";

const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const readRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const handler = async (event: VerifyAuthChallengeResponseTriggerEvent) => {
  const attemptedPhone = normalizePhoneNumber(event.request.userAttributes.phone_number ?? event.userName);
  const allowedPhoneNumber = getAllowedPhoneNumber();

  if (attemptedPhone !== allowedPhoneNumber) {
    event.response.answerCorrect = false;
    return event;
  }

  const phoneHash = await hashPhoneNumber(attemptedPhone);
  const otpTableName = readRequiredEnv("OTP_TABLE_NAME");
  const nowInSeconds = Math.floor(Date.now() / 1000);

  const otpRecord = await dynamoClient.send(
    new GetCommand({
      TableName: otpTableName,
      Key: {
        phone_hash: phoneHash,
      },
      ConsistentRead: true,
    }),
  );

  const storedOtpHash = otpRecord.Item?.otp_hash;
  const expiresAt = otpRecord.Item?.expires_at;
  if (!storedOtpHash || typeof expiresAt !== "number" || expiresAt < nowInSeconds) {
    logPhoneEvent("otp.challenge.verify_failed", {
      phone_hash: phoneHash,
      reason: "missing_or_expired",
    });

    event.response.answerCorrect = false;
    return event;
  }

  const candidateHash = await hashOtpCode(phoneHash, normalizePhoneNumber(event.request.challengeAnswer));
  const matches = safeOtpEquals(storedOtpHash, candidateHash);

  if (matches) {
    await dynamoClient.send(
      new DeleteCommand({
        TableName: otpTableName,
        Key: {
          phone_hash: phoneHash,
        },
      }),
    );

    logPhoneEvent("otp.challenge.verified", {
      phone_hash: phoneHash,
      verified_at: nowInSeconds,
    });
  } else {
    logPhoneEvent("otp.challenge.verify_failed", {
      phone_hash: phoneHash,
      reason: "mismatch",
    });
  }

  event.response.answerCorrect = matches;
  return event;
};
