// Stage 5 Smart File Public Token Helpers Purpose
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SignJWT, jwtVerify } from "jose";

type SmartFileTokenSecret = {
  readonly signingKey: string;
  readonly verificationSalt: string;
};

type SmartFilePublicClaims = {
  readonly resource_type: "smart_file";
  readonly resource_id: string;
  readonly expires_at: string;
};

const secretArn = process.env.STUDIO_OS_SMART_FILE_SECRET_ARN;

if (!secretArn) {
  throw new Error("Missing required environment variable: STUDIO_OS_SMART_FILE_SECRET_ARN");
}

const secretsManager = new SecretsManagerClient({});

const loadSecret = async (): Promise<SmartFileTokenSecret> => {
  const response = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    }),
  );

  if (!response.SecretString) {
    throw new Error("Smart File secret is empty.");
  }

  const parsed = JSON.parse(response.SecretString) as Partial<SmartFileTokenSecret>;
  if (!parsed.signingKey) {
    throw new Error("Smart File secret is missing signingKey.");
  }

  return {
    signingKey: parsed.signingKey,
    verificationSalt: parsed.verificationSalt ?? parsed.signingKey,
  };
};

const getKeyBytes = (secret: SmartFileTokenSecret) => new TextEncoder().encode(secret.signingKey);

export const issueSmartFilePublicToken = async (smartFileId: string, expiresAt: Date) => {
  const secret = await loadSecret();
  const token = await new SignJWT({
    resource_type: "smart_file",
    resource_id: smartFileId,
    expires_at: expiresAt.toISOString(),
  } satisfies SmartFilePublicClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getKeyBytes(secret));

  return {
    token,
    expiresAt,
  };
};

export const verifySmartFilePublicToken = async (token: string) => {
  const secret = await loadSecret();
  const verification = await jwtVerify(token, getKeyBytes(secret), {
    algorithms: ["HS256"],
  });

  const claims = verification.payload as Partial<SmartFilePublicClaims>;
  if (claims.resource_type !== "smart_file" || !claims.resource_id || !claims.expires_at) {
    throw new Error("Smart File token is invalid.");
  }

  return {
    smartFileId: claims.resource_id,
    expiresAt: new Date(claims.expires_at),
  };
};

export const loadSmartFileVerificationSalt = async () => {
  const secret = await loadSecret();
  return secret.verificationSalt;
};
