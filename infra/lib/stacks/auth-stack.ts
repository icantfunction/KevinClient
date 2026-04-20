// Stage 1 Auth Stack Purpose
import * as cdk from "aws-cdk-lib";
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as cr from "aws-cdk-lib/custom-resources";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { StudioOsStageConfig } from "../config/stage-config";
import { StudioOsNetworkStack } from "./network-stack";

export type StudioOsAuthStackProps = cdk.StackProps & {
  readonly stageConfig: StudioOsStageConfig;
  readonly network: StudioOsNetworkStack;
};

export class StudioOsAuthStack extends cdk.Stack {
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;
  public readonly otpTableName: string;
  public readonly phoneHashSecretArn: string;

  constructor(scope: Construct, id: string, props: StudioOsAuthStackProps) {
    super(scope, id, props);

    const { stageConfig } = props;
    const applicationLogRetention = logs.RetentionDays.TWO_WEEKS;

    const phoneHashSaltSecret = new secretsmanager.Secret(this, "PhoneHashSaltSecret", {
      secretName: `${stageConfig.prefix}/auth/phone-hash-salt`,
      description: "Per-environment salt used to hash phone numbers for OTP auth logs.",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: "phoneHashSalt",
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 64,
      },
    });

    const otpTable = new dynamodb.Table(this, "OtpTable", {
      tableName: `${stageConfig.prefix}-otp`,
      partitionKey: {
        name: "phone_hash",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expires_at",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const otpRateLimitTable = new dynamodb.Table(this, "OtpRateLimitTable", {
      tableName: `${stageConfig.prefix}-otp-rate-limit`,
      partitionKey: {
        name: "phone_hash",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expires_at",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const defineAuthChallengeFunction = new nodejs.NodejsFunction(this, "DefineAuthChallengeFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "lambda/define-auth-challenge/index.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: applicationLogRetention,
      bundling: {
        target: "node20",
        format: nodejs.OutputFormat.CJS,
      },
      environment: {
        ALLOWED_PHONE_NUMBER: stageConfig.allowedPhoneNumber,
        PHONE_HASH_SALT_SECRET_ARN: phoneHashSaltSecret.secretArn,
      },
    });

    const createAuthChallengeFunction = new nodejs.NodejsFunction(this, "CreateAuthChallengeFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "lambda/create-auth-challenge/index.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(15),
      memorySize: 256,
      logRetention: applicationLogRetention,
      bundling: {
        target: "node20",
        format: nodejs.OutputFormat.CJS,
      },
      environment: {
        ALLOWED_PHONE_NUMBER: stageConfig.allowedPhoneNumber,
        PHONE_HASH_SALT_SECRET_ARN: phoneHashSaltSecret.secretArn,
        OTP_TABLE_NAME: otpTable.tableName,
        OTP_RATE_LIMIT_TABLE_NAME: otpRateLimitTable.tableName,
        OTP_TTL_SECONDS: "300",
        OTP_RATE_LIMIT_WINDOW_SECONDS: "900",
        OTP_RATE_LIMIT_MAX_CODES: "3",
      },
    });

    const verifyAuthChallengeFunction = new nodejs.NodejsFunction(this, "VerifyAuthChallengeFunction", {
      runtime: lambda.Runtime.NODEJS_20_X,
      entry: "lambda/verify-auth-challenge/index.ts",
      handler: "handler",
      timeout: cdk.Duration.seconds(10),
      memorySize: 256,
      logRetention: applicationLogRetention,
      bundling: {
        target: "node20",
        format: nodejs.OutputFormat.CJS,
      },
      environment: {
        ALLOWED_PHONE_NUMBER: stageConfig.allowedPhoneNumber,
        PHONE_HASH_SALT_SECRET_ARN: phoneHashSaltSecret.secretArn,
        OTP_TABLE_NAME: otpTable.tableName,
      },
    });

    phoneHashSaltSecret.grantRead(defineAuthChallengeFunction);
    phoneHashSaltSecret.grantRead(createAuthChallengeFunction);
    phoneHashSaltSecret.grantRead(verifyAuthChallengeFunction);
    otpTable.grantReadWriteData(createAuthChallengeFunction);
    otpTable.grantReadWriteData(verifyAuthChallengeFunction);
    otpRateLimitTable.grantReadWriteData(createAuthChallengeFunction);
    createAuthChallengeFunction.addToRolePolicy(
      new cdk.aws_iam.PolicyStatement({
        actions: ["sns:Publish"],
        resources: ["*"],
      }),
    );

    const userPool = new cognito.CfnUserPool(this, "KevinUserPool", {
      userPoolName: `${stageConfig.prefix}-user-pool`,
      usernameAttributes: ["phone_number"],
      adminCreateUserConfig: {
        allowAdminCreateUserOnly: true,
      },
      lambdaConfig: {
        defineAuthChallenge: defineAuthChallengeFunction.functionArn,
        createAuthChallenge: createAuthChallengeFunction.functionArn,
        verifyAuthChallengeResponse: verifyAuthChallengeFunction.functionArn,
      },
      policies: {
        passwordPolicy: {
          minimumLength: 12,
          requireLowercase: false,
          requireNumbers: false,
          requireSymbols: false,
          requireUppercase: false,
          temporaryPasswordValidityDays: 1,
        },
      },
      mfaConfiguration: "OFF",
      userPoolAddOns: {
        advancedSecurityMode: "AUDIT",
      },
    });

    defineAuthChallengeFunction.addPermission("AllowCognitoInvokeDefineAuth", {
      principal: new cdk.aws_iam.ServicePrincipal("cognito-idp.amazonaws.com"),
      sourceArn: userPool.attrArn,
    });

    createAuthChallengeFunction.addPermission("AllowCognitoInvokeCreateAuth", {
      principal: new cdk.aws_iam.ServicePrincipal("cognito-idp.amazonaws.com"),
      sourceArn: userPool.attrArn,
    });

    verifyAuthChallengeFunction.addPermission("AllowCognitoInvokeVerifyAuth", {
      principal: new cdk.aws_iam.ServicePrincipal("cognito-idp.amazonaws.com"),
      sourceArn: userPool.attrArn,
    });

    const userPoolClient = new cognito.CfnUserPoolClient(this, "KevinUserPoolClient", {
      clientName: `${stageConfig.prefix}-app-client`,
      userPoolId: userPool.ref,
      explicitAuthFlows: ["ALLOW_CUSTOM_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
      accessTokenValidity: 15,
      idTokenValidity: 15,
      refreshTokenValidity: 30,
      tokenValidityUnits: {
        accessToken: "minutes",
        idToken: "minutes",
        refreshToken: "days",
      },
      enableTokenRevocation: true,
      preventUserExistenceErrors: "ENABLED",
      generateSecret: false,
    });

    const kevinUser = new cognito.CfnUserPoolUser(this, "KevinSeedUser", {
      userPoolId: userPool.ref,
      username: stageConfig.allowedPhoneNumber,
      messageAction: "SUPPRESS",
      desiredDeliveryMediums: [],
      userAttributes: [
        {
          name: "phone_number",
          value: stageConfig.allowedPhoneNumber,
        },
        {
          name: "phone_number_verified",
          value: "true",
        },
      ],
    });

    kevinUser.addDependency(userPoolClient);

    new cr.AwsCustomResource(this, "SmsPreferences", {
      onCreate: {
        service: "SNS",
        action: "setSMSAttributes",
        parameters: {
          attributes: {
            DefaultSMSType: "Transactional",
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of(`${stageConfig.prefix}-sms-preferences`),
      },
      onUpdate: {
        service: "SNS",
        action: "setSMSAttributes",
        parameters: {
          attributes: {
            DefaultSMSType: "Transactional",
          },
        },
        physicalResourceId: cr.PhysicalResourceId.of(`${stageConfig.prefix}-sms-preferences`),
      },
      policy: cr.AwsCustomResourcePolicy.fromStatements([
        new cdk.aws_iam.PolicyStatement({
          actions: ["sns:SetSMSAttributes"],
          resources: ["*"],
        }),
      ]),
      installLatestAwsSdk: false,
    });

    this.userPoolId = userPool.ref;
    this.userPoolClientId = userPoolClient.ref;
    this.otpTableName = otpTable.tableName;
    this.phoneHashSecretArn = phoneHashSaltSecret.secretArn;

    new cdk.CfnOutput(this, "UserPoolId", {
      value: userPool.ref,
      exportName: `${stageConfig.prefix}-user-pool-id`,
    });

    new cdk.CfnOutput(this, "UserPoolClientId", {
      value: userPoolClient.ref,
      exportName: `${stageConfig.prefix}-user-pool-client-id`,
    });

    new cdk.CfnOutput(this, "OtpTableName", {
      value: otpTable.tableName,
      exportName: `${stageConfig.prefix}-otp-table-name`,
    });

    new cdk.CfnOutput(this, "PhoneHashSaltSecretArn", {
      value: phoneHashSaltSecret.secretArn,
      exportName: `${stageConfig.prefix}-phone-hash-salt-secret-arn`,
    });
  }
}
