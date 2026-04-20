// Stage 2 Database Client Purpose
import { RDSDataClient } from "@aws-sdk/client-rds-data";
import { drizzle, type AwsDataApiPgDatabase } from "drizzle-orm/aws-data-api/pg";
import { resolveDatabaseRuntimeConfig } from "./config";
import * as schema from "./schema/index";

export type StudioOsDatabase = AwsDataApiPgDatabase<typeof schema>;

let cachedDatabase: StudioOsDatabase | undefined;
let cachedRdsClient: RDSDataClient | undefined;

export const createDatabaseClient = (): StudioOsDatabase => {
  if (cachedDatabase) {
    return cachedDatabase;
  }

  const runtimeConfig = resolveDatabaseRuntimeConfig();
  cachedRdsClient = new RDSDataClient({
    region: runtimeConfig.region,
  });

  cachedDatabase = drizzle(cachedRdsClient, {
    database: runtimeConfig.databaseName,
    resourceArn: runtimeConfig.resourceArn,
    secretArn: runtimeConfig.secretArn,
    schema,
  });

  return cachedDatabase;
};

export const createRawRdsDataClient = (): RDSDataClient => {
  if (cachedRdsClient) {
    return cachedRdsClient;
  }

  const runtimeConfig = resolveDatabaseRuntimeConfig();
  cachedRdsClient = new RDSDataClient({
    region: runtimeConfig.region,
  });

  return cachedRdsClient;
};
