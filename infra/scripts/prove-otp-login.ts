// Stage 1 OTP Proof Script Purpose
import { createHash } from "node:crypto";
import {
  CloudFormationClient,
  DescribeStacksCommand,
  type Output,
} from "@aws-sdk/client-cloudformation";
import {
  AdminInitiateAuthCommand,
  AdminRespondToAuthChallengeCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand } from "@aws-sdk/lib-dynamodb";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
const prefix = "studio-os-stage-1";
const authStackName = `${prefix}-auth`;
const allowedPhoneNumber = "+19548541484";

const cloudFormation = new CloudFormationClient({ region });
const cognito = new CognitoIdentityProviderClient({ region });
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({ region }));
const secrets = new SecretsManagerClient({ region });

const requireOutput = (outputs: Record<string, string>, key: string): string => {
  const value = outputs[key];
  if (!value) {
    throw new Error(`Missing CloudFormation output ${key}.`);
  }

  return value;
};

const isStackOutput = (output: Output): output is Output & { OutputKey: string; OutputValue: string } =>
  Boolean(output.OutputKey && output.OutputValue);

const main = async () => {
  const stackResponse = await cloudFormation.send(
    new DescribeStacksCommand({
      StackName: authStackName,
    }),
  );

  const outputs = Object.fromEntries(
    (stackResponse.Stacks?.[0]?.Outputs ?? [])
      .filter(isStackOutput)
      .map((output) => [output.OutputKey, output.OutputValue]),
  );

  const userPoolId = requireOutput(outputs, "UserPoolId");
  const userPoolClientId = requireOutput(outputs, "UserPoolClientId");
  const otpTableName = requireOutput(outputs, "OtpTableName");
  const phoneHashSaltSecretArn = requireOutput(outputs, "PhoneHashSaltSecretArn");

  const secretValue = await secrets.send(
    new GetSecretValueCommand({
      SecretId: phoneHashSaltSecretArn,
    }),
  );

  if (!secretValue.SecretString) {
    throw new Error("Phone hash salt secret was empty.");
  }

  const parsedSecret = JSON.parse(secretValue.SecretString) as { phoneHashSalt?: string };
  if (!parsedSecret.phoneHashSalt) {
    throw new Error("Phone hash salt secret did not contain phoneHashSalt.");
  }

  const phoneHash = createHash("sha256")
    .update(`${parsedSecret.phoneHashSalt}:${allowedPhoneNumber}`)
    .digest("hex");

  const initiateResponse = await cognito.send(
    new AdminInitiateAuthCommand({
      UserPoolId: userPoolId,
      ClientId: userPoolClientId,
      AuthFlow: "CUSTOM_AUTH",
      AuthParameters: {
        USERNAME: allowedPhoneNumber,
      },
    }),
  );

  if (!initiateResponse.Session) {
    throw new Error("Cognito did not return a challenge session.");
  }

  await new Promise((resolve) => setTimeout(resolve, 2_000));

  const otpRecord = await dynamo.send(
    new GetCommand({
      TableName: otpTableName,
      Key: {
        phone_hash: phoneHash,
      },
      ConsistentRead: true,
    }),
  );

  if (!otpRecord.Item?.otp_hash) {
    throw new Error("OTP record was not written. SMS delivery may have failed before persistence.");
  }

  throw new Error(
    "OTP proof script stopped after challenge creation because Stage 1 stores only a hashed OTP by design. Complete the final step by reading the SMS sent to +19548541484 and running AdminRespondToAuthChallenge with that code.",
  );
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
