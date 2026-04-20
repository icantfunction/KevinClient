// Stage 5 Smart File Proof Script Purpose
import { randomUUID } from "node:crypto";
import {
  CloudFormationClient,
  DescribeStacksCommand,
  ListStackResourcesCommand,
  type Output,
  type StackResourceSummary,
} from "@aws-sdk/client-cloudformation";
import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { ClientsService, SmartFilesService, createDatabaseClient } from "@studio-os/database";
import { applyStageEnvironment } from "../../packages/database/scripts/shared";

type StackOutputs = Record<string, string>;

type LambdaHttpResponse<TBody extends Record<string, unknown>> = {
  readonly statusCode: number;
  readonly body: TBody;
};

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const apiStackName = "studio-os-stage-1-api";
const cloudFormation = new CloudFormationClient({ region });
const lambda = new LambdaClient({ region });
const s3 = new S3Client({ region });

const requireOutput = (outputs: StackOutputs, key: string) => {
  const value = outputs[key];
  if (!value) {
    throw new Error(`Missing CloudFormation output ${key}.`);
  }

  return value;
};

const isStackOutput = (output: Output): output is Output & { OutputKey: string; OutputValue: string } =>
  Boolean(output.OutputKey && output.OutputValue);

const isStackResource = (resource: StackResourceSummary): resource is StackResourceSummary & {
  LogicalResourceId: string;
  PhysicalResourceId: string;
} => Boolean(resource.LogicalResourceId && resource.PhysicalResourceId);

const loadOutputs = async (stackName: string): Promise<StackOutputs> => {
  const response = await cloudFormation.send(
    new DescribeStacksCommand({
      StackName: stackName,
    }),
  );

  return Object.fromEntries(
    (response.Stacks?.[0]?.Outputs ?? [])
      .filter(isStackOutput)
      .map((output) => [output.OutputKey, output.OutputValue]),
  );
};

const loadApiFunctions = async () => {
  const resources: StackResourceSummary[] = [];
  let nextToken: string | undefined;

  do {
    const response = await cloudFormation.send(
      new ListStackResourcesCommand({
        StackName: apiStackName,
        NextToken: nextToken,
      }),
    );
    resources.push(...(response.StackResourceSummaries ?? []));
    nextToken = response.NextToken;
  } while (nextToken);

  return Object.fromEntries(
    resources
      .filter(isStackResource)
      .map((resource) => [resource.LogicalResourceId, resource.PhysicalResourceId]),
  );
};

const requireFunctionName = (functions: Record<string, string>, logicalIdPrefix: string) => {
  const match = Object.entries(functions).find(([logicalId]) => logicalId.startsWith(logicalIdPrefix));
  if (!match) {
    throw new Error(`Missing Lambda function with logical id prefix ${logicalIdPrefix}.`);
  }

  return match[1];
};

const invokeHttpLambda = async <TBody extends Record<string, unknown>>(
  functionName: string,
  event: Record<string, unknown>,
): Promise<LambdaHttpResponse<TBody>> => {
  const response = await lambda.send(
    new InvokeCommand({
      FunctionName: functionName,
      Payload: Buffer.from(JSON.stringify(event)),
    }),
  );

  if (!response.Payload) {
    throw new Error(`Lambda ${functionName} returned an empty payload.`);
  }

  const rawPayload = Buffer.from(response.Payload).toString("utf8");
  if (response.FunctionError) {
    throw new Error(`Lambda ${functionName} failed: ${rawPayload}`);
  }

  const parsed = JSON.parse(rawPayload) as { statusCode?: number; body?: string };
  return {
    statusCode: parsed.statusCode ?? 500,
    body: parsed.body ? (JSON.parse(parsed.body) as TBody) : ({} as TBody),
  };
};

const withAuroraResumeRetry = async <T>(operation: () => Promise<T>, attempts = 3): Promise<T> => {
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : `${error}`;
      if (!message.includes("DatabaseResumingException") || attempt === attempts) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 15_000));
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Aurora resume retry exhausted.");
};

const waitForCompletion = async (smartFilesService: SmartFilesService, smartFileId: string) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 90_000) {
    const current = await withAuroraResumeRetry(() => smartFilesService.getSmartFileById(smartFileId));
    if (current?.pdfS3Key && current.status === "completed") {
      return current;
    }

    await new Promise((resolve) => setTimeout(resolve, 3_000));
  }

  throw new Error(`Timed out waiting for Smart File ${smartFileId} PDF generation.`);
};

const main = async () => {
  await applyStageEnvironment();

  const apiOutputs = await loadOutputs(apiStackName);
  process.env.AWS_REGION = region;
  process.env.STUDIO_OS_SMART_FILE_SECRET_ARN = requireOutput(apiOutputs, "SmartFileSecretArn");
  process.env.STUDIO_OS_SMART_FILE_VERIFICATION_TABLE_NAME = requireOutput(apiOutputs, "SmartFileVerificationTableName");

  const { seedSmartFileVerificationCodeForTesting } = await import("../lambda/shared/smart-file-verification");
  const apiFunctions = await loadApiFunctions();
  const apiUrl = requireOutput(apiOutputs, "ApiUrl");
  const smartFileBucketName = requireOutput(apiOutputs, "SmartFileBucketName");
  const createTemplateFunctionName = requireFunctionName(apiFunctions, "CreateSmartFileTemplateFunction");
  const createSmartFileFunctionName = requireFunctionName(apiFunctions, "CreateSmartFileFunction");
  const sendSmartFileFunctionName = requireFunctionName(apiFunctions, "SendSmartFileFunction");

  const database = createDatabaseClient();
  const clientsService = new ClientsService(database);
  const smartFilesService = new SmartFilesService(database);

  const occurredAt = new Date();
  const client = await withAuroraResumeRetry(() =>
    clientsService.createClient(
      {
        clientType: "photo",
        primaryName: "Stage 5 Proof Client",
        email: `stage5-proof-${Date.now()}@example.com`,
        phone: "+19548541484",
      },
      {
        actor: "system:stage-5-proof",
        occurredAt,
      },
    ),
  );

  const templateResponse = await invokeHttpLambda<{ template?: { id: string } }>(
    createTemplateFunctionName,
    {
      body: JSON.stringify({
        name: `Stage 5 Proof Template ${Date.now()}`,
        category: "portrait",
        title: "Stage 5 Proof Contract",
        blocks: [
          {
            id: "proof-text",
            type: "TEXT_BLOCK",
            order: 1,
            title: "Welcome",
            content: "Hi {{client.name}}, please review your portrait session agreement.",
          },
          {
            id: "proof-contract",
            type: "CONTRACT_BLOCK",
            order: 2,
            title: "Agreement",
            content: "I, {{request:full_legal_name}}, agree to Kevin's portrait session terms.",
          },
        ],
      }),
    },
  );

  const templateId = templateResponse.body.template?.id;
  if (!templateId || templateResponse.statusCode !== 201) {
    throw new Error(`Template creation failed: ${JSON.stringify(templateResponse)}`);
  }

  const createSmartFileResponse = await invokeHttpLambda<{ smartFile?: { id: string } }>(
    createSmartFileFunctionName,
    {
      headers: {
        "Idempotency-Key": randomUUID(),
      },
      body: JSON.stringify({
        templateId,
        clientId: client.id,
        title: "Stage 5 Proof Smart File",
        recipientEmail: client.email,
        recipientPhone: client.phone,
        message: "Please review and sign your Smart File.",
      }),
    },
  );

  const smartFileId = createSmartFileResponse.body.smartFile?.id;
  if (!smartFileId || createSmartFileResponse.statusCode !== 201) {
    throw new Error(`Smart File creation failed: ${JSON.stringify(createSmartFileResponse)}`);
  }

  const sendResponse = await invokeHttpLambda<{
    signUrl?: string;
    deliveryStatus?: string;
    deliveryError?: string | null;
  }>(sendSmartFileFunctionName, {
    pathParameters: {
      id: smartFileId,
    },
  });

  if (!sendResponse.body.signUrl || sendResponse.statusCode !== 200) {
    throw new Error(`Smart File send failed: ${JSON.stringify(sendResponse)}`);
  }

  const signUrl = sendResponse.body.signUrl;
  const publicGetResponse = await fetch(signUrl);
  const publicGetBody = (await publicGetResponse.json()) as Record<string, unknown>;

  const verificationResponse = await fetch(`${signUrl}/request-verification`, {
    method: "POST",
  });
  const verificationBody = (await verificationResponse.json()) as Record<string, unknown>;

  const testVerificationCode = "246810";
  await seedSmartFileVerificationCodeForTesting(smartFileId, client.phone!, testVerificationCode);

  const submitResponse = await fetch(`${signUrl}/submit`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      responseData: {
        full_legal_name: "Stage Five Proof Client",
      },
      signatureMethod: "typed",
      signatureName: "Stage Five Proof Client",
      verificationCode: testVerificationCode,
    }),
  });
  const submitBody = (await submitResponse.json()) as Record<string, unknown>;

  if (!submitResponse.ok) {
    throw new Error(`Smart File submit failed: ${JSON.stringify(submitBody)}`);
  }

  const completedSmartFile = await waitForCompletion(smartFilesService, smartFileId);
  await s3.send(
    new HeadObjectCommand({
      Bucket: smartFileBucketName,
      Key: completedSmartFile.pdfS3Key ?? undefined,
    }),
  );

  console.log(
    JSON.stringify(
      {
        apiUrl,
        smartFileId,
        templateId,
        signUrl,
        publicGetStatus: publicGetResponse.status,
        publicGetBody,
        requestVerificationStatus: verificationResponse.status,
        requestVerificationBody: verificationBody,
        submitStatus: submitResponse.status,
        submitBody,
        deliveryStatus: sendResponse.body.deliveryStatus,
        deliveryError: sendResponse.body.deliveryError ?? null,
        finalStatus: completedSmartFile.status,
        pdfS3Key: completedSmartFile.pdfS3Key,
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
