// Stage 1 Define Auth Challenge Lambda Purpose
import type { DefineAuthChallengeTriggerEvent } from "aws-lambda";
import { getAllowedPhoneNumber, hashPhoneNumber, logPhoneEvent, normalizePhoneNumber } from "../shared/otp-auth";

export const handler = async (event: DefineAuthChallengeTriggerEvent) => {
  const attemptedPhone = normalizePhoneNumber(event.request.userAttributes.phone_number ?? event.userName);
  const allowedPhoneNumber = getAllowedPhoneNumber();
  const phoneHash = attemptedPhone ? await hashPhoneNumber(attemptedPhone) : "unknown";

  if (attemptedPhone !== allowedPhoneNumber) {
    logPhoneEvent("otp.define.rejected", {
      phone_hash: phoneHash,
      reason: "phone_not_allowlisted",
    });

    event.response.issueTokens = false;
    event.response.failAuthentication = true;
    return event;
  }

  const previousAttempt = event.request.session.at(-1);

  if (!previousAttempt) {
    event.response.challengeName = "CUSTOM_CHALLENGE";
    event.response.issueTokens = false;
    event.response.failAuthentication = false;
    return event;
  }

  if (previousAttempt.challengeName === "CUSTOM_CHALLENGE" && previousAttempt.challengeResult) {
    logPhoneEvent("otp.define.accepted", {
      phone_hash: phoneHash,
    });

    event.response.issueTokens = true;
    event.response.failAuthentication = false;
    return event;
  }

  logPhoneEvent("otp.define.failed", {
    phone_hash: phoneHash,
  });

  event.response.issueTokens = false;
  event.response.failAuthentication = true;
  return event;
};
