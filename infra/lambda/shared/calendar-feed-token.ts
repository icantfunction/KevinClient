// Stage 4 Calendar Feed Token Helpers Purpose
import { GetSecretValueCommand, PutSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SignJWT, jwtVerify } from "jose";

type CalendarFeedSecret = {
  readonly signingKey: string;
  readonly version: number;
};

type CalendarFeedClaims = {
  readonly scope: "calendar.ics";
  readonly version: number;
};

const secretArn = process.env.STUDIO_OS_CALENDAR_FEED_SECRET_ARN;

if (!secretArn) {
  throw new Error("Missing required environment variable: STUDIO_OS_CALENDAR_FEED_SECRET_ARN");
}

const secretsManager = new SecretsManagerClient({});

const decodeSecret = (value: string): CalendarFeedSecret => {
  const parsed = JSON.parse(value) as Partial<CalendarFeedSecret>;

  if (!parsed.signingKey || typeof parsed.version !== "number") {
    throw new Error("Calendar feed secret is missing signingKey or version.");
  }

  return {
    signingKey: parsed.signingKey,
    version: parsed.version,
  };
};

const loadSecret = async (): Promise<CalendarFeedSecret> => {
  const response = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    }),
  );

  if (!response.SecretString) {
    throw new Error("Calendar feed secret is empty.");
  }

  return decodeSecret(response.SecretString);
};

const getKeyBytes = (secret: CalendarFeedSecret) => new TextEncoder().encode(secret.signingKey);

export const issueCalendarFeedToken = async (expiresInDays = 365) => {
  const secret = await loadSecret();
  const issuedAt = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    scope: "calendar.ics",
    version: secret.version,
  } satisfies CalendarFeedClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + expiresInDays * 24 * 60 * 60)
    .sign(getKeyBytes(secret));

  return {
    token,
    version: secret.version,
  };
};

export const verifyCalendarFeedToken = async (token: string) => {
  const secret = await loadSecret();
  const verification = await jwtVerify(token, getKeyBytes(secret), {
    algorithms: ["HS256"],
  });

  const claims = verification.payload as Partial<CalendarFeedClaims>;

  if (claims.scope !== "calendar.ics") {
    throw new Error("Calendar feed token scope is invalid.");
  }

  if (claims.version !== secret.version) {
    throw new Error("Calendar feed token has been revoked.");
  }

  return claims;
};

export const revokeCalendarFeedTokens = async () => {
  const current = await loadSecret();
  const nextValue = JSON.stringify({
    signingKey: current.signingKey,
    version: current.version + 1,
  });

  await secretsManager.send(
    new PutSecretValueCommand({
      SecretId: secretArn,
      SecretString: nextValue,
    }),
  );

  return {
    previousVersion: current.version,
    currentVersion: current.version + 1,
  };
};
