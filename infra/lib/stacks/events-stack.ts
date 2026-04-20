// Stage 9 Events Stack Purpose
import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as scheduler from "aws-cdk-lib/aws-scheduler";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import { Construct } from "constructs";
import { StudioOsStageConfig } from "../config/stage-config";
import { StudioOsApiStack } from "./api-stack";
import { StudioOsDataStack } from "./data-stack";

export type StudioOsEventsStackProps = cdk.StackProps & {
  readonly stageConfig: StudioOsStageConfig;
  readonly api: StudioOsApiStack;
  readonly data: StudioOsDataStack;
};

const resolveLogRetention = (days: number): logs.RetentionDays =>
  days <= 7 ? logs.RetentionDays.ONE_WEEK : logs.RetentionDays.TWO_WEEKS;

export class StudioOsEventsStack extends cdk.Stack {
  public constructor(scope: Construct, id: string, props: StudioOsEventsStackProps) {
    super(scope, id, props);

    const projectRoot = path.resolve(__dirname, "../../..");
    const applicationLogRetention = resolveLogRetention(props.stageConfig.logRetentionDays.application);
    const sharedEnvironment = {
      STAGE_NAME: props.stageConfig.stageName,
      STUDIO_OS_DATABASE_NAME: props.stageConfig.databaseName,
      STUDIO_OS_DATABASE_RESOURCE_ARN: props.data.cluster.clusterArn,
      STUDIO_OS_DATABASE_SECRET_ARN: props.data.cluster.secret!.secretArn,
      STUDIO_OS_EVENT_BUS_NAME: "default",
      STUDIO_OS_SES_FROM_EMAIL: props.stageConfig.sesFromEmail,
      STUDIO_OS_SES_CONFIGURATION_SET_NAME: props.stageConfig.sesConfigurationSetName,
      STUDIO_OS_ALLOWED_PHONE_NUMBER: props.stageConfig.allowedPhoneNumber,
      STUDIO_OS_TIMEZONE: props.stageConfig.timezone,
      STUDIO_OS_API_URL: props.api.apiUrl,
    };

    const createNodeFunction = (name: string, entry: string, environment?: Record<string, string>) =>
      new nodejs.NodejsFunction(this, name, {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry,
        handler: "handler",
        timeout: cdk.Duration.seconds(60),
        memorySize: 512,
        logRetention: applicationLogRetention,
        depsLockFilePath: path.join(projectRoot, "pnpm-lock.yaml"),
        bundling: {
          target: "node20",
          format: nodejs.OutputFormat.CJS,
        },
        environment: {
          ...sharedEnvironment,
          ...environment,
        },
      });

    const sequenceRunnerFunction = createNodeFunction("SequenceRunnerFunction", "lambda/events-sequence-runner/index.ts", {
      STUDIO_OS_SMART_FILE_SECRET_ARN: props.api.smartFileSecretArn,
    });
    const weatherFetcherFunction = createNodeFunction("WeatherFetcherFunction", "lambda/events-weather-fetcher/index.ts");
    const galleryExpiryFunction = createNodeFunction("GalleryExpiryFunction", "lambda/events-gallery-expiry/index.ts");
    const invoiceOverdueFunction = createNodeFunction("InvoiceOverdueFunction", "lambda/events-invoice-overdue/index.ts");
    const accessCodeSmsFunction = createNodeFunction("AccessCodeSmsFunction", "lambda/events-access-code-sms/index.ts");
    const anniversaryRemindersFunction = createNodeFunction(
      "AnniversaryRemindersFunction",
      "lambda/events-anniversary-reminders/index.ts",
    );
    const monthlyReportsFunction = createNodeFunction("MonthlyReportsFunction", "lambda/events-monthly-reports/index.ts");
    const recurringTaskSpawnerFunction = createNodeFunction(
      "RecurringTaskSpawnerFunction",
      "lambda/events-recurring-task-spawner/index.ts",
    );
    const auditPartitionPrecreateFunction = createNodeFunction(
      "AuditPartitionPrecreateFunction",
      "lambda/events-audit-partition-precreate/index.ts",
    );
    const outboxPublisherFunction = createNodeFunction("OutboxPublisherFunction", "lambda/events-outbox-publisher/index.ts", {
      STUDIO_OS_OUTBOX_BATCH_SIZE: "100",
    });

    const functions = [
      sequenceRunnerFunction,
      weatherFetcherFunction,
      galleryExpiryFunction,
      invoiceOverdueFunction,
      accessCodeSmsFunction,
      anniversaryRemindersFunction,
      monthlyReportsFunction,
      recurringTaskSpawnerFunction,
      auditPartitionPrecreateFunction,
      outboxPublisherFunction,
    ];

    functions.forEach((functionResource) => {
      props.data.cluster.grantDataApiAccess(functionResource);
      functionResource.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["events:PutEvents"],
          resources: [`arn:aws:events:${this.region}:${this.account}:event-bus/default`],
        }),
      );
      functionResource.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["ses:SendEmail", "ses:SendRawEmail", "sns:Publish"],
          resources: ["*"],
        }),
      );
    });

    secretsmanager.Secret.fromSecretCompleteArn(this, "ImportedSmartFileSecret", props.api.smartFileSecretArn).grantRead(
      sequenceRunnerFunction,
    );

    const scheduleInvokeRole = new iam.Role(this, "ScheduleInvokeRole", {
      assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
    });

    functions.forEach((functionResource) => {
      functionResource.grantInvoke(scheduleInvokeRole);
    });

    const createSchedule = (name: string, expression: string, target: lambda.IFunction) => {
      new scheduler.CfnSchedule(this, name, {
        flexibleTimeWindow: {
          mode: "OFF",
        },
        scheduleExpression: expression,
        scheduleExpressionTimezone: props.stageConfig.timezone,
        target: {
          arn: target.functionArn,
          roleArn: scheduleInvokeRole.roleArn,
        },
      });
    };

    createSchedule("SequenceRunnerSchedule", "rate(6 hours)", sequenceRunnerFunction);
    createSchedule("WeatherFetcherSchedule", "rate(6 hours)", weatherFetcherFunction);
    createSchedule("GalleryExpirySchedule", "cron(0 9 * * ? *)", galleryExpiryFunction);
    createSchedule("InvoiceOverdueSchedule", "cron(15 9 * * ? *)", invoiceOverdueFunction);
    createSchedule("AccessCodeSmsSchedule", "rate(15 minutes)", accessCodeSmsFunction);
    createSchedule("AnniversaryRemindersSchedule", "cron(30 9 * * ? *)", anniversaryRemindersFunction);
    createSchedule("MonthlyReportsSchedule", "cron(0 9 1 * ? *)", monthlyReportsFunction);
    createSchedule("RecurringTaskSpawnerSchedule", "cron(0 6 * * ? *)", recurringTaskSpawnerFunction);
    createSchedule("AuditPartitionPrecreateSchedule", "cron(0 2 25 * ? *)", auditPartitionPrecreateFunction);
    createSchedule("OutboxPublisherSchedule", "rate(1 minute)", outboxPublisherFunction);

    const outboxMetricDimensions = {
      Stage: props.stageConfig.stageName,
      Function: "OutboxPublisher",
    };

    new cloudwatch.Alarm(this, "OutboxRetryExceededAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "StudioOs/Events",
        metricName: "OutboxFailedRows",
        dimensionsMap: outboxMetricDimensions,
        statistic: "Maximum",
        period: cdk.Duration.minutes(1),
      }),
      evaluationPeriods: 1,
      threshold: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "At least one outbox row has exceeded five publish attempts.",
    });

    new cloudwatch.Alarm(this, "OutboxStaleAlarm", {
      metric: new cloudwatch.Metric({
        namespace: "StudioOs/Events",
        metricName: "OutboxOldestUnpublishedAgeSeconds",
        dimensionsMap: outboxMetricDimensions,
        statistic: "Maximum",
        period: cdk.Duration.minutes(1),
      }),
      evaluationPeriods: 1,
      threshold: 300,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: "The oldest unpublished outbox row is older than five minutes.",
    });
  }
}
