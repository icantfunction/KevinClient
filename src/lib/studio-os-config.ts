// Stage 10 Runtime Config Purpose
const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const studioOsRuntimeConfig = {
  apiUrl: trimTrailingSlash(
    process.env.NEXT_PUBLIC_STUDIO_OS_API_URL ?? "https://2bb3ndmvqf.execute-api.us-east-1.amazonaws.com/",
  ),
  userPoolId: process.env.NEXT_PUBLIC_STUDIO_OS_USER_POOL_ID ?? "us-east-1_jXkMyElVh",
  userPoolClientId: process.env.NEXT_PUBLIC_STUDIO_OS_USER_POOL_CLIENT_ID ?? "2i2e3m4e3e7trt94mnv8ck0u63",
  allowedPhoneNumber: process.env.NEXT_PUBLIC_STUDIO_OS_ALLOWED_PHONE_NUMBER ?? "+19548541484",
};

export const studioOsCognitoRegion = studioOsRuntimeConfig.userPoolId.split("_")[0] ?? "us-east-1";
