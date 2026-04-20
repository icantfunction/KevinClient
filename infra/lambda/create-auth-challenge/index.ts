// Stage 1 Create Auth Challenge Lambda Purpose
import type { CreateAuthChallengeTriggerEvent } from "aws-lambda";
import { PublishCommand, SNSClient } from "@aws-sdk/client-sns";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import {
  createOtpCode,
  getAllowedPhoneNumber,
  getTemporaryOtpOverrideCode,
  hashOtpCode,
  hashPhoneNumber,
  logPhoneEvent,
  normalizePhoneNumber,
} from "../shared/otp-auth";

const snsClient = new SNSClient({});
const dynamoClient = DynamoDBDocumentClient.from(new DynamoDBClient({}));

const readRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const handler = async (event: CreateAuthChallengeTriggerEvent) => {
  const attemptedPhone = normalizePhoneNumber(event.request.userAttributes.phone_number ?? event.userName);
  const allowedPhoneNumber = getAllowedPhoneNumber();

  if (attemptedPhone !== allowedPhoneNumber) {
    throw new Error("Unauthorized phone number.");
  }

  const phoneHash = await hashPhoneNumber(attemptedPhone);
  const otpTableName = readRequiredEnv("OTP_TABLE_NAME");
  const otpRateLimitTableName = readRequiredEnv("OTP_RATE_LIMIT_TABLE_NAME");
  const otpTtlSeconds = Number.parseInt(readRequiredEnv("OTP_TTL_SECONDS"), 10);
  const rateLimitWindowSeconds = Number.parseInt(readRequiredEnv("OTP_RATE_LIMIT_WINDOW_SECONDS"), 10);
  const rateLimitMaxCodes = Number.parseInt(readRequiredEnv("OTP_RATE_LIMIT_MAX_CODES"), 10);
  const nowInSeconds = Math.floor(Date.now() / 1000);
  const temporaryOverrideCode = getTemporaryOtpOverrideCode();

  if (!temporaryOverrideCode) {
    await dynamoClient.send(
      new UpdateCommand({
        TableName: otpRateLimitTableName,
        Key: {
          phone_hash: phoneHash,
        },
        UpdateExpression:
          "SET request_count = if_not_exists(request_count, :zero) + :one, expires_at = if_not_exists(expires_at, :expiresAt), window_started_at = if_not_exists(window_started_at, :windowStartedAt)",
        ConditionExpression: "attribute_not_exists(request_count) OR request_count < :maxCodes",
        ExpressionAttributeValues: {
          ":zero": 0,
          ":one": 1,
          ":maxCodes": rateLimitMaxCodes,
          ":expiresAt": nowInSeconds + rateLimitWindowSeconds,
          ":windowStartedAt": nowInSeconds,
        },
      }),
    );
  }

  const otpCode = temporaryOverrideCode ?? createOtpCode();
  const otpHash = await hashOtpCode(phoneHash, otpCode);

  await dynamoClient.send(
    new PutCommand({
      TableName: otpTableName,
      Item: {
        phone_hash: phoneHash,
        otp_hash: otpHash,
        expires_at: nowInSeconds + otpTtlSeconds,
        issued_at: nowInSeconds,
      },
    }),
  );

  if (temporaryOverrideCode) {
    logPhoneEvent("otp.challenge.override_issued", {
      phone_hash: phoneHash,
      expires_at: nowInSeconds + otpTtlSeconds,
    });
  } else {
    await snsClient.send(
      new PublishCommand({
        PhoneNumber: attemptedPhone,
        Message: `${otpCode} is your Kevin's Studio OS login code. It expires in 5 minutes.`,
        MessageAttributes: {
          "AWS.SNS.SMS.SMSType": {
            DataType: "String",
            StringValue: "Transactional",
          },
        },
      }),
    );
  }

  logPhoneEvent("otp.challenge.issued", {
    phone_hash: phoneHash,
    expires_at: nowInSeconds + otpTtlSeconds,
  });

  event.response.publicChallengeParameters = {
    destination: temporaryOverrideCode
      ? "temporary-otp-override"
      : `${attemptedPhone.slice(0, 2)}******${attemptedPhone.slice(-2)}`,
  };
  event.response.privateChallengeParameters = {
    phoneHash,
  };
  event.response.challengeMetadata = "STUDIO_OS_OTP";

  return event;
};
