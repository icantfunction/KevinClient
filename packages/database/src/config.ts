// Stage 2 Database Config Purpose
export type StudioOsDatabaseRuntimeConfig = {
  readonly region: string;
  readonly databaseName: string;
  readonly resourceArn: string;
  readonly secretArn: string;
  readonly eventBusName: string;
};

const readRequiredEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
};

export const resolveDatabaseRuntimeConfig = (): StudioOsDatabaseRuntimeConfig => ({
  region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1",
  databaseName: readRequiredEnv("STUDIO_OS_DATABASE_NAME"),
  resourceArn: readRequiredEnv("STUDIO_OS_DATABASE_RESOURCE_ARN"),
  secretArn: readRequiredEnv("STUDIO_OS_DATABASE_SECRET_ARN"),
  eventBusName: process.env.STUDIO_OS_EVENT_BUS_NAME ?? "default",
});
