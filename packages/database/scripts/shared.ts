// Stage 2 Database Script Helpers Purpose
import { DescribeStacksCommand, CloudFormationClient } from "@aws-sdk/client-cloudformation";

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const cloudFormationClient = new CloudFormationClient({ region });

export type DataStackOutputs = {
  readonly databaseName: string;
  readonly resourceArn: string;
  readonly secretArn: string;
  readonly eventBusName: string;
};

const requireOutput = (outputs: Record<string, string>, key: string): string => {
  const value = outputs[key];
  if (!value) {
    throw new Error(`Missing CloudFormation output ${key}.`);
  }

  return value;
};

export const loadDataStackOutputs = async (): Promise<DataStackOutputs> => {
  const response = await cloudFormationClient.send(
    new DescribeStacksCommand({
      StackName: "studio-os-stage-1-data",
    }),
  );

  const outputMap = Object.fromEntries(
    (response.Stacks?.[0]?.Outputs ?? [])
      .filter((output): output is { OutputKey: string; OutputValue: string } => Boolean(output.OutputKey && output.OutputValue))
      .map((output) => [output.OutputKey, output.OutputValue]),
  );

  return {
    databaseName: requireOutput(outputMap, "DatabaseName"),
    resourceArn: requireOutput(outputMap, "DatabaseClusterArn"),
    secretArn: requireOutput(outputMap, "DatabaseSecretArn"),
    eventBusName: outputMap.EventBusName ?? "default",
  };
};

export const applyStageEnvironment = async (): Promise<DataStackOutputs> => {
  const outputs = await loadDataStackOutputs();
  process.env.AWS_REGION = region;
  process.env.STUDIO_OS_DATABASE_NAME = outputs.databaseName;
  process.env.STUDIO_OS_DATABASE_RESOURCE_ARN = outputs.resourceArn;
  process.env.STUDIO_OS_DATABASE_SECRET_ARN = outputs.secretArn;
  process.env.STUDIO_OS_EVENT_BUS_NAME = outputs.eventBusName;
  return outputs;
};

const sleep = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const isDatabaseResumingError = (error: unknown) =>
  error instanceof Error &&
  (error.name === "DatabaseResumingException" || error.message.includes("DatabaseResumingException"));

export const withDatabaseResumeRetry = async <T>(
  operation: () => Promise<T>,
  input: {
    readonly maxAttempts?: number;
    readonly delayMs?: number;
    readonly label?: string;
  } = {},
): Promise<T> => {
  const maxAttempts = input.maxAttempts ?? 6;
  const delayMs = input.delayMs ?? 15_000;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isDatabaseResumingError(error) || attempt === maxAttempts) {
        throw error;
      }

      const label = input.label ?? "database operation";
      console.warn(`${label} hit DatabaseResumingException on attempt ${attempt}; retrying in ${delayMs}ms.`);
      await sleep(delayMs);
    }
  }

  throw new Error("Database resume retry loop exhausted.");
};
