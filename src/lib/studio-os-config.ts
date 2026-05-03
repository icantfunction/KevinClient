// Stage 10 Runtime Config Purpose
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const publicConfigDefaults = {
  NEXT_PUBLIC_STUDIO_OS_API_URL:
    "https://2bb3ndmvqf.execute-api.us-east-1.amazonaws.com/",
  NEXT_PUBLIC_STUDIO_OS_USER_POOL_ID: "us-east-1_jXkMyElVh",
  NEXT_PUBLIC_STUDIO_OS_USER_POOL_CLIENT_ID: "2i2e3m4e3e7trt94mnv8ck0u63",
  NEXT_PUBLIC_STUDIO_OS_ALLOWED_PHONE_NUMBER: "+19548541484",
} as const;

const shouldEnforceExplicitPublicConfig =
  process.env.NODE_ENV === "production" &&
  (process.env.CI === "true" || Boolean(process.env.AWS_BRANCH));

const readRequiredPublicValue = (
  key: keyof typeof publicConfigDefaults,
): string => {
  const value = process.env[key]?.trim();
  if (value) {
    return value;
  }

  if (!shouldEnforceExplicitPublicConfig) {
    return publicConfigDefaults[key];
  }

  throw new Error(
    `Missing required public runtime config: ${key}. Production builds must provide explicit Studio OS environment variables.`,
  );
};

export const studioOsRuntimeConfig = {
  apiUrl: trimTrailingSlash(
    readRequiredPublicValue("NEXT_PUBLIC_STUDIO_OS_API_URL"),
  ),
  userPoolId: readRequiredPublicValue("NEXT_PUBLIC_STUDIO_OS_USER_POOL_ID"),
  userPoolClientId: readRequiredPublicValue(
    "NEXT_PUBLIC_STUDIO_OS_USER_POOL_CLIENT_ID",
  ),
  allowedPhoneNumber: readRequiredPublicValue(
    "NEXT_PUBLIC_STUDIO_OS_ALLOWED_PHONE_NUMBER",
  ),
};

export const studioOsCognitoRegion =
  studioOsRuntimeConfig.userPoolId.split("_")[0] ?? "us-east-1";
