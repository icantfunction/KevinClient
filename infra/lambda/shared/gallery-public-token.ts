// Stage 6 Gallery Public Token Helpers Purpose
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SignJWT, jwtVerify } from "jose";

type GalleryTokenSecret = {
  readonly signingKey: string;
};

type GalleryPublicClaims = {
  readonly resource_type: "gallery";
  readonly resource_id: string;
  readonly expires_at: string;
};

const secretArn = process.env.STUDIO_OS_GALLERY_SECRET_ARN;

if (!secretArn) {
  throw new Error("Missing required environment variable: STUDIO_OS_GALLERY_SECRET_ARN");
}

const secretsManager = new SecretsManagerClient({});

const loadSecret = async (): Promise<GalleryTokenSecret> => {
  const response = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: secretArn,
    }),
  );

  if (!response.SecretString) {
    throw new Error("Gallery secret is empty.");
  }

  const parsed = JSON.parse(response.SecretString) as Partial<GalleryTokenSecret>;
  if (!parsed.signingKey) {
    throw new Error("Gallery secret is missing signingKey.");
  }

  return {
    signingKey: parsed.signingKey,
  };
};

const getKeyBytes = (secret: GalleryTokenSecret) => new TextEncoder().encode(secret.signingKey);

export const issueGalleryPublicToken = async (galleryId: string, expiresAt: Date) => {
  const secret = await loadSecret();
  const token = await new SignJWT({
    resource_type: "gallery",
    resource_id: galleryId,
    expires_at: expiresAt.toISOString(),
  } satisfies GalleryPublicClaims)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(getKeyBytes(secret));

  return {
    token,
    expiresAt,
  };
};

export const verifyGalleryPublicToken = async (token: string) => {
  const secret = await loadSecret();
  const verification = await jwtVerify(token, getKeyBytes(secret), {
    algorithms: ["HS256"],
  });

  const claims = verification.payload as Partial<GalleryPublicClaims>;
  if (claims.resource_type !== "gallery" || !claims.resource_id || !claims.expires_at) {
    throw new Error("Gallery token is invalid.");
  }

  return {
    galleryId: claims.resource_id,
    expiresAt: new Date(claims.expires_at),
  };
};
