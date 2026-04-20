// Stage 3 API Stack Purpose
import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as apigwv2 from "aws-cdk-lib/aws-apigatewayv2";
import * as authorizers from "aws-cdk-lib/aws-apigatewayv2-authorizers";
import * as integrations from "aws-cdk-lib/aws-apigatewayv2-integrations";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as eventSources from "aws-cdk-lib/aws-lambda-event-sources";
import * as logs from "aws-cdk-lib/aws-logs";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as ses from "aws-cdk-lib/aws-ses";
import * as sesActions from "aws-cdk-lib/aws-ses-actions";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as sns from "aws-cdk-lib/aws-sns";
import * as subscriptions from "aws-cdk-lib/aws-sns-subscriptions";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { StudioOsStageConfig } from "../config/stage-config";
import { StudioOsAuthStack } from "./auth-stack";
import { StudioOsDataStack } from "./data-stack";
import { StudioOsMediaStack } from "./media-stack";

export type StudioOsApiStackProps = cdk.StackProps & {
  readonly stageConfig: StudioOsStageConfig;
  readonly auth: StudioOsAuthStack;
  readonly data: StudioOsDataStack;
  readonly media: StudioOsMediaStack;
};

const resolveLogRetention = (days: number): logs.RetentionDays =>
  days <= 7 ? logs.RetentionDays.ONE_WEEK : logs.RetentionDays.TWO_WEEKS;

export class StudioOsApiStack extends cdk.Stack {
  public readonly apiUrl: string;
  public readonly smartFileSecretArn: string;

  constructor(scope: Construct, id: string, props: StudioOsApiStackProps) {
    super(scope, id, props);

    const applicationLogRetention = resolveLogRetention(props.stageConfig.logRetentionDays.application);
    const accessLogRetention = resolveLogRetention(props.stageConfig.logRetentionDays.access);
    const projectRoot = path.resolve(__dirname, "../../..");
    const sharedEnvironment = {
      STAGE_NAME: props.stageConfig.stageName,
      STUDIO_OS_DATABASE_NAME: props.stageConfig.databaseName,
      STUDIO_OS_DATABASE_RESOURCE_ARN: props.data.cluster.clusterArn,
      STUDIO_OS_DATABASE_SECRET_ARN: props.data.cluster.secret!.secretArn,
      STUDIO_OS_EVENT_BUS_NAME: "default",
      STUDIO_OS_IDEMPOTENCY_TABLE_NAME: props.data.idempotencyTable.tableName,
      STUDIO_OS_SES_FROM_EMAIL: props.stageConfig.sesFromEmail,
      STUDIO_OS_SES_CONFIGURATION_SET_NAME: props.stageConfig.sesConfigurationSetName,
      STUDIO_OS_STRIPE_MODE: process.env.STUDIO_OS_STRIPE_MODE ?? "test",
      STUDIO_OS_STRIPE_TEST_SECRET_NAME: process.env.STUDIO_OS_STRIPE_TEST_SECRET_NAME ?? "studio-os/stripe/test",
      STUDIO_OS_STRIPE_LIVE_SECRET_NAME: process.env.STUDIO_OS_STRIPE_LIVE_SECRET_NAME ?? "studio-os/stripe/live",
    };

    const calendarFeedSecret = new secretsmanager.Secret(this, "CalendarFeedSecret", {
      secretName: `${props.stageConfig.prefix}/calendar/feed-secret`,
      description: "Signing secret and version for Kevin Studio OS iCal feed tokens.",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ version: 1 }),
        generateStringKey: "signingKey",
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 64,
      },
    });

    const smartFileSecret = new secretsmanager.Secret(this, "SmartFileSecret", {
      secretName: `${props.stageConfig.prefix}/smart-files/access-secret`,
      description: "Signing key and verification salt for Smart File public tokens and verification codes.",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: "signingKey",
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 64,
      },
    });
    this.smartFileSecretArn = smartFileSecret.secretArn;

    const gallerySecret = new secretsmanager.Secret(this, "GallerySecret", {
      secretName: `${props.stageConfig.prefix}/galleries/access-secret`,
      description: "Signing key for gallery public magic-link tokens.",
      generateSecretString: {
        secretStringTemplate: JSON.stringify({}),
        generateStringKey: "signingKey",
        excludePunctuation: true,
        includeSpace: false,
        passwordLength: 64,
      },
    });

    const createNodeFunction = (name: string, entry: string, environment?: Record<string, string>) =>
      new nodejs.NodejsFunction(this, name, {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry,
        handler: "handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
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

    const healthFunction = createNodeFunction("HealthFunction", "lambda/api-health/index.ts");
    const createInquiryFunction = createNodeFunction("CreateInquiryFunction", "lambda/api-inquiries-create/index.ts");
    const listInquiriesFunction = createNodeFunction("ListInquiriesFunction", "lambda/api-inquiries-list/index.ts");
    const listInboxFunction = createNodeFunction("ListInboxFunction", "lambda/api-inbox-list/index.ts");
    const listClientsFunction = createNodeFunction("ListClientsFunction", "lambda/api-clients-list/index.ts");
    const clientTimelineFunction = createNodeFunction("ClientTimelineFunction", "lambda/api-client-timeline/index.ts");
    const createSessionFunction = createNodeFunction("CreateSessionFunction", "lambda/api-sessions-create/index.ts");
    const listSessionsFunction = createNodeFunction("ListSessionsFunction", "lambda/api-sessions-list/index.ts");
    const getShotListFunction = createNodeFunction("GetShotListFunction", "lambda/api-shot-list-get/index.ts");
    const upsertShotListFunction = createNodeFunction("UpsertShotListFunction", "lambda/api-shot-list-upsert/index.ts");
    const listCalendarFunction = createNodeFunction("ListCalendarFunction", "lambda/api-calendar-list/index.ts");
    const dashboardSummaryFunction = createNodeFunction("DashboardSummaryFunction", "lambda/api-dashboard-summary/index.ts");
    const listTasksFunction = createNodeFunction("ListTasksFunction", "lambda/api-tasks-list/index.ts");
    const searchFunction = createNodeFunction("SearchFunction", "lambda/api-search/index.ts");
    const listTimeEntriesFunction = createNodeFunction("ListTimeEntriesFunction", "lambda/api-time-entries-list/index.ts");
    const createTimeEntryFunction = createNodeFunction("CreateTimeEntryFunction", "lambda/api-time-entries-create/index.ts");
    const stopTimeEntryFunction = createNodeFunction("StopTimeEntryFunction", "lambda/api-time-entry-stop/index.ts");
    const createGalleryFunction = createNodeFunction("CreateGalleryFunction", "lambda/api-galleries-create/index.ts");
    const listGalleriesFunction = createNodeFunction("ListGalleriesFunction", "lambda/api-galleries-list/index.ts");
    const getGalleryFunction = createNodeFunction("GetGalleryFunction", "lambda/api-galleries-get/index.ts");
    const shareGalleryFunction = createNodeFunction("ShareGalleryFunction", "lambda/api-galleries-share/index.ts");
    const initiateGalleryUploadFunction = createNodeFunction("InitiateGalleryUploadFunction", "lambda/api-gallery-upload-initiate/index.ts");
    const getGalleryUploadPartUrlFunction = createNodeFunction("GetGalleryUploadPartUrlFunction", "lambda/api-gallery-upload-part-url/index.ts");
    const completeGalleryUploadFunction = createNodeFunction("CompleteGalleryUploadFunction", "lambda/api-gallery-upload-complete/index.ts");
    const createStudioSpaceFunction = createNodeFunction("CreateStudioSpaceFunction", "lambda/api-studio-spaces-create/index.ts");
    const listStudioSpacesFunction = createNodeFunction("ListStudioSpacesFunction", "lambda/api-studio-spaces-list/index.ts");
    const createStudioEquipmentFunction = createNodeFunction("CreateStudioEquipmentFunction", "lambda/api-studio-equipment-create/index.ts");
    const listStudioEquipmentFunction = createNodeFunction("ListStudioEquipmentFunction", "lambda/api-studio-equipment-list/index.ts");
    const createStudioBookingFunction = createNodeFunction("CreateStudioBookingFunction", "lambda/api-studio-bookings-create/index.ts");
    const listStudioBookingsFunction = createNodeFunction("ListStudioBookingsFunction", "lambda/api-studio-bookings-list/index.ts");
    const getStudioBookingFunction = createNodeFunction("GetStudioBookingFunction", "lambda/api-studio-bookings-get/index.ts");
    const updateStudioBookingFunction = createNodeFunction("UpdateStudioBookingFunction", "lambda/api-studio-bookings-update/index.ts");
    const getStudioCalendarFunction = createNodeFunction("GetStudioCalendarFunction", "lambda/api-studio-calendar-get/index.ts");
    const createInvoiceFunction = createNodeFunction("CreateInvoiceFunction", "lambda/api-invoices-create/index.ts");
    const listInvoicesFunction = createNodeFunction("ListInvoicesFunction", "lambda/api-invoices-list/index.ts");
    const getInvoiceFunction = createNodeFunction("GetInvoiceFunction", "lambda/api-invoices-get/index.ts");
    const createPaymentFunction = createNodeFunction("CreatePaymentFunction", "lambda/api-payments-create/index.ts");
    const listPaymentsFunction = createNodeFunction("ListPaymentsFunction", "lambda/api-payments-list/index.ts");
    const getPaymentProviderFunction = createNodeFunction("GetPaymentProviderFunction", "lambda/api-payments-provider-get/index.ts");
    const createInvoiceCheckoutFunction = createNodeFunction("CreateInvoiceCheckoutFunction", "lambda/api-invoice-checkout-create/index.ts");
    const refundPaymentFunction = createNodeFunction("RefundPaymentFunction", "lambda/api-payment-refund/index.ts");
    const createExpenseFunction = createNodeFunction("CreateExpenseFunction", "lambda/api-expenses-create/index.ts");
    const listExpensesFunction = createNodeFunction("ListExpensesFunction", "lambda/api-expenses-list/index.ts");
    const createExpenseReceiptScanFunction = createNodeFunction(
      "CreateExpenseReceiptScanFunction",
      "lambda/api-expense-receipt-scan-upload/index.ts",
    );
    const getExpenseReceiptScanFunction = createNodeFunction(
      "GetExpenseReceiptScanFunction",
      "lambda/api-expense-receipt-scan-get/index.ts",
    );
    const revenueReportFunction = createNodeFunction("RevenueReportFunction", "lambda/api-report-revenue/index.ts");
    const profitReportFunction = createNodeFunction("ProfitReportFunction", "lambda/api-report-profit/index.ts");
    const taxYearReportFunction = createNodeFunction("TaxYearReportFunction", "lambda/api-report-tax-year/index.ts");
    const studioUtilizationReportFunction = createNodeFunction(
      "StudioUtilizationReportFunction",
      "lambda/api-report-studio-utilization/index.ts",
    );
    const conversionReportFunction = createNodeFunction("ConversionReportFunction", "lambda/api-report-conversion/index.ts");
    const turnaroundReportFunction = createNodeFunction("TurnaroundReportFunction", "lambda/api-report-turnaround/index.ts");
    const referralsReportFunction = createNodeFunction("ReferralsReportFunction", "lambda/api-report-referrals/index.ts");
    const ltvReportFunction = createNodeFunction("LtvReportFunction", "lambda/api-report-ltv/index.ts");
    const createSmartFileTemplateFunction = createNodeFunction(
      "CreateSmartFileTemplateFunction",
      "lambda/api-smart-file-templates-create/index.ts",
    );
    const listSmartFileTemplatesFunction = createNodeFunction(
      "ListSmartFileTemplatesFunction",
      "lambda/api-smart-file-templates-list/index.ts",
    );
    const createSmartFileFunction = createNodeFunction("CreateSmartFileFunction", "lambda/api-smart-files-create/index.ts");
    const listSmartFilesFunction = createNodeFunction("ListSmartFilesFunction", "lambda/api-smart-files-list/index.ts");
    const getSmartFileFunction = createNodeFunction("GetSmartFileFunction", "lambda/api-smart-files-get/index.ts");
    const sendSmartFileFunction = createNodeFunction("SendSmartFileFunction", "lambda/api-smart-files-send/index.ts");
    const issueCalendarFeedTokenFunction = createNodeFunction(
      "IssueCalendarFeedTokenFunction",
      "lambda/api-calendar-feed-token/index.ts",
      {
        STUDIO_OS_CALENDAR_FEED_SECRET_ARN: calendarFeedSecret.secretArn,
      },
    );
    const revokeCalendarFeedTokenFunction = createNodeFunction(
      "RevokeCalendarFeedTokenFunction",
      "lambda/api-calendar-feed-revoke/index.ts",
      {
        STUDIO_OS_CALENDAR_FEED_SECRET_ARN: calendarFeedSecret.secretArn,
      },
    );
    const calendarIcsFunction = createNodeFunction("CalendarIcsFunction", "lambda/api-calendar-ics/index.ts", {
      STUDIO_OS_CALENDAR_FEED_SECRET_ARN: calendarFeedSecret.secretArn,
    });
    const publicSmartFileGetFunction = createNodeFunction("PublicSmartFileGetFunction", "lambda/public-smart-file-get/index.ts", {
      STUDIO_OS_SMART_FILE_SECRET_ARN: smartFileSecret.secretArn,
    });
    const publicSmartFilePageFunction = createNodeFunction("PublicSmartFilePageFunction", "lambda/public-smart-file-page/index.ts");
    const publicSmartFilePaymentIntentFunction = createNodeFunction(
      "PublicSmartFilePaymentIntentFunction",
      "lambda/public-smart-file-payment-intent/index.ts",
      {
        STUDIO_OS_SMART_FILE_SECRET_ARN: smartFileSecret.secretArn,
      },
    );
    const requestSmartFileVerificationFunction = createNodeFunction(
      "RequestSmartFileVerificationFunction",
      "lambda/public-smart-file-request-verification/index.ts",
      {
        STUDIO_OS_SMART_FILE_SECRET_ARN: smartFileSecret.secretArn,
      },
    );
    const submitSmartFileFunction = createNodeFunction("SubmitSmartFileFunction", "lambda/public-smart-file-submit/index.ts", {
      STUDIO_OS_SMART_FILE_SECRET_ARN: smartFileSecret.secretArn,
    });
    const stripeWebhookFunction = createNodeFunction("StripeWebhookFunction", "lambda/stripe-webhook/index.ts");
    const publicGalleryGetFunction = createNodeFunction("PublicGalleryGetFunction", "lambda/public-gallery-get/index.ts", {
      STUDIO_OS_GALLERY_SECRET_ARN: gallerySecret.secretArn,
      STUDIO_OS_GALLERY_DERIVATIVES_BUCKET_NAME: props.media.galleryDerivativesBucket.bucketName,
    });
    const publicGalleryPageFunction = createNodeFunction("PublicGalleryPageFunction", "lambda/public-gallery-page/index.ts", {
      STUDIO_OS_GALLERY_SECRET_ARN: gallerySecret.secretArn,
      STUDIO_OS_GALLERY_DERIVATIVES_BUCKET_NAME: props.media.galleryDerivativesBucket.bucketName,
    });
    const publicStudioPageFunction = createNodeFunction("PublicStudioPageFunction", "lambda/public-studio-page/index.ts");
    const publicStudioBookingRequestFunction = createNodeFunction(
      "PublicStudioBookingRequestFunction",
      "lambda/public-studio-booking-request/index.ts",
    );
    const publicStudioAccessVerifyFunction = createNodeFunction(
      "PublicStudioAccessVerifyFunction",
      "lambda/public-studio-access-verify/index.ts",
    );
    const inquiryAutoResponseFunction = createNodeFunction(
      "InquiryAutoResponseFunction",
      "lambda/events-inquiry-auto-response/index.ts",
    );

    const smartFileVerificationTable = new dynamodb.Table(this, "SmartFileVerificationTable", {
      tableName: `${props.stageConfig.prefix}-smart-file-verification`,
      partitionKey: {
        name: "verification_key",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expires_at",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const smartFilePdfDlq = new sqs.Queue(this, "SmartFilePdfDlq", {
      queueName: `${props.stageConfig.prefix}-smart-file-pdf-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    const smartFilePdfQueue = new sqs.Queue(this, "SmartFilePdfQueue", {
      queueName: `${props.stageConfig.prefix}-smart-file-pdf`,
      visibilityTimeout: cdk.Duration.seconds(180),
      deadLetterQueue: {
        queue: smartFilePdfDlq,
        maxReceiveCount: 3,
      },
      enforceSSL: true,
    });

    const smartFileBucket = new s3.Bucket(this, "SmartFileBucket", {
      bucketName: `${props.stageConfig.prefix}-smart-files-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const smartFilePdfWorkerFunction = createNodeFunction("SmartFilePdfWorkerFunction", "lambda/smart-file-pdf-worker/index.ts", {
      STUDIO_OS_SMART_FILE_BUCKET_NAME: smartFileBucket.bucketName,
    });

    const expenseReceiptsBucket = new s3.Bucket(this, "ExpenseReceiptsBucket", {
      bucketName: `${props.stageConfig.prefix}-expense-receipts-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const expenseReceiptOcrFunction = createNodeFunction(
      "ExpenseReceiptOcrFunction",
      "lambda/events-expense-receipt-ocr/index.ts",
      {
        STUDIO_OS_EXPENSE_RECEIPTS_BUCKET_NAME: expenseReceiptsBucket.bucketName,
      },
    );

    expenseReceiptsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(expenseReceiptOcrFunction),
      { prefix: "receipts/" },
    );

    smartFilePdfWorkerFunction.addEventSource(
      new eventSources.SqsEventSource(smartFilePdfQueue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      }),
    );

    const inboundParserDlq = new sqs.Queue(this, "InboundParserDlq", {
      queueName: `${props.stageConfig.prefix}-inbound-email-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    const inboundEmailQueue = new sqs.Queue(this, "InboundEmailQueue", {
      queueName: `${props.stageConfig.prefix}-inbound-email`,
      visibilityTimeout: cdk.Duration.seconds(120),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: inboundParserDlq,
        maxReceiveCount: 3,
      },
      enforceSSL: true,
    });

    const inboundEmailBucket = new s3.Bucket(this, "InboundEmailBucket", {
      bucketName: `${props.stageConfig.prefix}-inbound-email-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      lifecycleRules: [
        {
          expiration: cdk.Duration.days(30),
          prefix: "raw/",
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    inboundEmailBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.SqsDestination(inboundEmailQueue),
      { prefix: "raw/" },
    );

    const inboundParserFunction = createNodeFunction("InboundEmailParserFunction", "lambda/ses-inbound-parser/index.ts", {
      STUDIO_OS_INBOUND_EMAIL_BUCKET_NAME: inboundEmailBucket.bucketName,
    });
    const sesEventLoggerFunction = createNodeFunction("SesEventLoggerFunction", "lambda/ses-event-logger/index.ts");

    inboundParserFunction.addEventSource(
      new eventSources.SqsEventSource(inboundEmailQueue, {
        batchSize: 1,
        reportBatchItemFailures: true,
      }),
    );

    const sesEventLoggerDlq = new sqs.Queue(this, "SesEventLoggerDlq", {
      queueName: `${props.stageConfig.prefix}-ses-events-dlq`,
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    const sesEventQueue = new sqs.Queue(this, "SesEventQueue", {
      queueName: `${props.stageConfig.prefix}-ses-events`,
      visibilityTimeout: cdk.Duration.seconds(120),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: sesEventLoggerDlq,
        maxReceiveCount: 3,
      },
      enforceSSL: true,
    });

    const sesEventTopic = new sns.Topic(this, "SesEventTopic", {
      topicName: `${props.stageConfig.prefix}-ses-events`,
    });

    sesEventTopic.addSubscription(
      new subscriptions.SqsSubscription(sesEventQueue, {
        rawMessageDelivery: false,
      }),
    );

    sesEventLoggerFunction.addEventSource(
      new eventSources.SqsEventSource(sesEventQueue, {
        batchSize: 10,
        reportBatchItemFailures: true,
      }),
    );

    const outboundConfigurationSet = new ses.ConfigurationSet(this, "OutboundConfigurationSet", {
      configurationSetName: props.stageConfig.sesConfigurationSetName,
      reputationMetrics: true,
      sendingEnabled: true,
    });

    outboundConfigurationSet.addEventDestination("OutboundSnsEventDestination", {
      destination: ses.EventDestination.snsTopic(sesEventTopic),
      events: [
        ses.EmailSendingEvent.SEND,
        ses.EmailSendingEvent.DELIVERY,
        ses.EmailSendingEvent.BOUNCE,
        ses.EmailSendingEvent.COMPLAINT,
        ses.EmailSendingEvent.OPEN,
        ses.EmailSendingEvent.CLICK,
      ],
    });

    const receiptRuleSet = new ses.ReceiptRuleSet(this, "InboundReceiptRuleSet", {
      receiptRuleSetName: `${props.stageConfig.prefix}-inbound`,
    });

    receiptRuleSet.addRule("StoreInboundEmailRule", {
      enabled: true,
      scanEnabled: true,
      tlsPolicy: ses.TlsPolicy.OPTIONAL,
      recipients: props.stageConfig.sesInboundRecipients.length > 0 ? props.stageConfig.sesInboundRecipients : undefined,
      actions: [
        new sesActions.S3({
          bucket: inboundEmailBucket,
          objectKeyPrefix: "raw/",
        }),
      ],
    });

    [
      createInquiryFunction,
      listInquiriesFunction,
      listInboxFunction,
      listClientsFunction,
      clientTimelineFunction,
      createSessionFunction,
      listSessionsFunction,
      getShotListFunction,
      upsertShotListFunction,
      listCalendarFunction,
      dashboardSummaryFunction,
      listTasksFunction,
      searchFunction,
      listTimeEntriesFunction,
      createTimeEntryFunction,
      stopTimeEntryFunction,
      createGalleryFunction,
      listGalleriesFunction,
      getGalleryFunction,
      shareGalleryFunction,
      initiateGalleryUploadFunction,
      getGalleryUploadPartUrlFunction,
      completeGalleryUploadFunction,
      createStudioSpaceFunction,
      listStudioSpacesFunction,
      createStudioEquipmentFunction,
      listStudioEquipmentFunction,
      createStudioBookingFunction,
      listStudioBookingsFunction,
      getStudioBookingFunction,
      updateStudioBookingFunction,
      getStudioCalendarFunction,
      createInvoiceFunction,
      listInvoicesFunction,
      getInvoiceFunction,
      createPaymentFunction,
      listPaymentsFunction,
      getPaymentProviderFunction,
      createInvoiceCheckoutFunction,
      refundPaymentFunction,
      createExpenseFunction,
      listExpensesFunction,
      createExpenseReceiptScanFunction,
      getExpenseReceiptScanFunction,
      revenueReportFunction,
      profitReportFunction,
      taxYearReportFunction,
      studioUtilizationReportFunction,
      conversionReportFunction,
      turnaroundReportFunction,
      referralsReportFunction,
      ltvReportFunction,
      createSmartFileTemplateFunction,
      listSmartFileTemplatesFunction,
      createSmartFileFunction,
      listSmartFilesFunction,
      getSmartFileFunction,
      sendSmartFileFunction,
      publicGalleryGetFunction,
      publicGalleryPageFunction,
      publicStudioPageFunction,
      publicStudioBookingRequestFunction,
      publicStudioAccessVerifyFunction,
      publicSmartFileGetFunction,
      publicSmartFilePageFunction,
      publicSmartFilePaymentIntentFunction,
      requestSmartFileVerificationFunction,
      submitSmartFileFunction,
      stripeWebhookFunction,
      smartFilePdfWorkerFunction,
      expenseReceiptOcrFunction,
      calendarIcsFunction,
      inquiryAutoResponseFunction,
      inboundParserFunction,
      sesEventLoggerFunction,
    ].forEach((functionResource) => {
      props.data.cluster.grantDataApiAccess(functionResource);
    });

    props.data.idempotencyTable.grantReadWriteData(createInquiryFunction);
    props.data.idempotencyTable.grantReadWriteData(createSessionFunction);
    props.data.idempotencyTable.grantReadWriteData(createTimeEntryFunction);
    props.data.idempotencyTable.grantReadWriteData(stopTimeEntryFunction);
    props.data.idempotencyTable.grantReadWriteData(createGalleryFunction);
    props.data.idempotencyTable.grantReadWriteData(createStudioSpaceFunction);
    props.data.idempotencyTable.grantReadWriteData(createStudioEquipmentFunction);
    props.data.idempotencyTable.grantReadWriteData(createStudioBookingFunction);
    props.data.idempotencyTable.grantReadWriteData(updateStudioBookingFunction);
    props.data.idempotencyTable.grantReadWriteData(createInvoiceFunction);
    props.data.idempotencyTable.grantReadWriteData(createPaymentFunction);
    props.data.idempotencyTable.grantReadWriteData(createInvoiceCheckoutFunction);
    props.data.idempotencyTable.grantReadWriteData(refundPaymentFunction);
    props.data.idempotencyTable.grantReadWriteData(createExpenseFunction);
    props.data.idempotencyTable.grantReadWriteData(createExpenseReceiptScanFunction);
    props.data.idempotencyTable.grantReadWriteData(publicStudioBookingRequestFunction);
    props.data.idempotencyTable.grantReadWriteData(createSmartFileFunction);
    props.data.idempotencyTable.grantReadWriteData(publicSmartFilePaymentIntentFunction);
    inboundEmailBucket.grantRead(inboundParserFunction);
    sesEventQueue.grantConsumeMessages(sesEventLoggerFunction);
    expenseReceiptsBucket.grantReadWrite(createExpenseReceiptScanFunction);
    expenseReceiptsBucket.grantRead(expenseReceiptOcrFunction);
    smartFileVerificationTable.grantReadWriteData(requestSmartFileVerificationFunction);
    smartFileVerificationTable.grantReadWriteData(submitSmartFileFunction);
    smartFileBucket.grantReadWrite(smartFilePdfWorkerFunction);
    smartFilePdfQueue.grantSendMessages(sendSmartFileFunction);
    smartFilePdfQueue.grantSendMessages(submitSmartFileFunction);
    props.media.galleryOriginalsBucket.grantReadWrite(initiateGalleryUploadFunction);
    props.media.galleryOriginalsBucket.grantReadWrite(getGalleryUploadPartUrlFunction);
    props.media.galleryOriginalsBucket.grantReadWrite(completeGalleryUploadFunction);
    props.media.galleryDerivativesBucket.grantRead(publicGalleryGetFunction);
    props.media.galleryDerivativesBucket.grantRead(publicGalleryPageFunction);
    smartFileSecret.grantRead(sendSmartFileFunction);
    smartFileSecret.grantRead(publicSmartFileGetFunction);
    smartFileSecret.grantRead(publicSmartFilePaymentIntentFunction);
    smartFileSecret.grantRead(requestSmartFileVerificationFunction);
    smartFileSecret.grantRead(submitSmartFileFunction);
    gallerySecret.grantRead(shareGalleryFunction);
    gallerySecret.grantRead(publicGalleryGetFunction);
    gallerySecret.grantRead(publicGalleryPageFunction);
    [createInquiryFunction, createSessionFunction, createTimeEntryFunction, stopTimeEntryFunction, createGalleryFunction, createStudioSpaceFunction, createStudioEquipmentFunction, createStudioBookingFunction, updateStudioBookingFunction, createInvoiceFunction, createPaymentFunction, createInvoiceCheckoutFunction, refundPaymentFunction, createExpenseFunction, createExpenseReceiptScanFunction, publicStudioBookingRequestFunction, publicStudioAccessVerifyFunction, upsertShotListFunction, createSmartFileTemplateFunction, createSmartFileFunction, shareGalleryFunction, sendSmartFileFunction, publicGalleryGetFunction, publicGalleryPageFunction, publicStudioPageFunction, publicSmartFileGetFunction, publicSmartFilePaymentIntentFunction, submitSmartFileFunction, stripeWebhookFunction, inquiryAutoResponseFunction, inboundParserFunction, sesEventLoggerFunction, smartFilePdfWorkerFunction, expenseReceiptOcrFunction].forEach((functionResource) => {
      functionResource.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["events:PutEvents"],
          resources: [`arn:aws:events:${this.region}:${this.account}:event-bus/default`],
        }),
      );
    });
    [requestSmartFileVerificationFunction].forEach((functionResource) => {
      functionResource.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["sns:Publish"],
          resources: ["*"],
        }),
      );
    });
    calendarFeedSecret.grantRead(issueCalendarFeedTokenFunction);
    calendarFeedSecret.grantRead(calendarIcsFunction);
    calendarFeedSecret.grantRead(revokeCalendarFeedTokenFunction);
    calendarFeedSecret.grantWrite(revokeCalendarFeedTokenFunction);
    inquiryAutoResponseFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      }),
    );
    sendSmartFileFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      }),
    );
    refundPaymentFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      }),
    );
    smartFilePdfWorkerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      }),
    );
    stripeWebhookFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ses:SendEmail", "ses:SendRawEmail"],
        resources: ["*"],
      }),
    );
    [getPaymentProviderFunction, createInvoiceCheckoutFunction, refundPaymentFunction, publicSmartFileGetFunction, publicSmartFilePaymentIntentFunction, stripeWebhookFunction].forEach((functionResource) => {
      functionResource.addToRolePolicy(
        new iam.PolicyStatement({
          actions: ["secretsmanager:GetSecretValue"],
          resources: [`arn:aws:secretsmanager:${this.region}:${this.account}:secret:studio-os/stripe/*`],
        }),
      );
    });
    expenseReceiptOcrFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["textract:AnalyzeExpense"],
        resources: ["*"],
      }),
    );

    const adminAuthorizer = new authorizers.HttpJwtAuthorizer(
      "KevinDashboardAuthorizer",
      `https://cognito-idp.${this.region}.amazonaws.com/${props.auth.userPoolId}`,
      {
        jwtAudience: [props.auth.userPoolClientId],
      },
    );

    const accessLogGroup = new logs.LogGroup(this, "HttpApiAccessLogs", {
      retention: accessLogRetention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const api = new apigwv2.HttpApi(this, "HttpApi", {
      apiName: `${props.stageConfig.prefix}-http-api`,
      createDefaultStage: true,
    });

    issueCalendarFeedTokenFunction.addEnvironment("STUDIO_OS_API_URL", api.url ?? "");
    shareGalleryFunction.addEnvironment("STUDIO_OS_API_URL", api.url ?? "");
    sendSmartFileFunction.addEnvironment("STUDIO_OS_API_URL", api.url ?? "");
    publicSmartFilePageFunction.addEnvironment("STUDIO_OS_API_URL", api.url ?? "");
    shareGalleryFunction.addEnvironment("STUDIO_OS_GALLERY_SECRET_ARN", gallerySecret.secretArn);
    initiateGalleryUploadFunction.addEnvironment("STUDIO_OS_GALLERY_ORIGINALS_BUCKET_NAME", props.media.galleryOriginalsBucket.bucketName);
    getGalleryUploadPartUrlFunction.addEnvironment("STUDIO_OS_GALLERY_ORIGINALS_BUCKET_NAME", props.media.galleryOriginalsBucket.bucketName);
    completeGalleryUploadFunction.addEnvironment("STUDIO_OS_GALLERY_ORIGINALS_BUCKET_NAME", props.media.galleryOriginalsBucket.bucketName);
    sendSmartFileFunction.addEnvironment("STUDIO_OS_SMART_FILE_SECRET_ARN", smartFileSecret.secretArn);
    sendSmartFileFunction.addEnvironment("STUDIO_OS_SMART_FILE_PDF_QUEUE_URL", smartFilePdfQueue.queueUrl);
    createExpenseReceiptScanFunction.addEnvironment("STUDIO_OS_EXPENSE_RECEIPTS_BUCKET_NAME", expenseReceiptsBucket.bucketName);
    requestSmartFileVerificationFunction.addEnvironment("STUDIO_OS_SMART_FILE_VERIFICATION_TABLE_NAME", smartFileVerificationTable.tableName);
    submitSmartFileFunction.addEnvironment("STUDIO_OS_SMART_FILE_VERIFICATION_TABLE_NAME", smartFileVerificationTable.tableName);
    submitSmartFileFunction.addEnvironment("STUDIO_OS_SMART_FILE_PDF_QUEUE_URL", smartFilePdfQueue.queueUrl);

    const defaultStage = api.defaultStage?.node.defaultChild as apigwv2.CfnStage;
    defaultStage.accessLogSettings = {
      destinationArn: accessLogGroup.logGroupArn,
      format: JSON.stringify({
        requestId: "$context.requestId",
        routeKey: "$context.routeKey",
        status: "$context.status",
        requestTime: "$context.requestTime",
        ip: "$context.identity.sourceIp",
      }),
    };

    api.addRoutes({
      path: "/health",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("HealthIntegration", healthFunction),
    });

    api.addRoutes({
      path: "/inquiries",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("CreateInquiryIntegration", createInquiryFunction),
    });

    api.addRoutes({
      path: "/inquiries",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListInquiriesIntegration", listInquiriesFunction),
    });

    api.addRoutes({
      path: "/inbox",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListInboxIntegration", listInboxFunction),
    });

    api.addRoutes({
      path: "/clients",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListClientsIntegration", listClientsFunction),
    });

    api.addRoutes({
      path: "/clients/{id}/timeline",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ClientTimelineIntegration", clientTimelineFunction),
    });

    api.addRoutes({
      path: "/sessions",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateSessionIntegration", createSessionFunction),
    });

    api.addRoutes({
      path: "/sessions",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListSessionsIntegration", listSessionsFunction),
    });

    api.addRoutes({
      path: "/sessions/{id}/shot-list",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("GetShotListIntegration", getShotListFunction),
    });

    api.addRoutes({
      path: "/sessions/{id}/shot-list",
      methods: [apigwv2.HttpMethod.PUT],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("UpsertShotListIntegration", upsertShotListFunction),
    });

    api.addRoutes({
      path: "/calendar",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListCalendarIntegration", listCalendarFunction),
    });

    api.addRoutes({
      path: "/dashboard",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("DashboardSummaryIntegration", dashboardSummaryFunction),
    });

    api.addRoutes({
      path: "/tasks",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListTasksIntegration", listTasksFunction),
    });

    api.addRoutes({
      path: "/search",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("SearchIntegration", searchFunction),
    });

    api.addRoutes({
      path: "/time-entries",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListTimeEntriesIntegration", listTimeEntriesFunction),
    });

    api.addRoutes({
      path: "/time-entries",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateTimeEntryIntegration", createTimeEntryFunction),
    });

    api.addRoutes({
      path: "/time-entries/{id}/stop",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("StopTimeEntryIntegration", stopTimeEntryFunction),
    });

    api.addRoutes({
      path: "/galleries",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateGalleryIntegration", createGalleryFunction),
    });

    api.addRoutes({
      path: "/galleries",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListGalleriesIntegration", listGalleriesFunction),
    });

    api.addRoutes({
      path: "/galleries/{id}",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("GetGalleryIntegration", getGalleryFunction),
    });

    api.addRoutes({
      path: "/galleries/{id}/share",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ShareGalleryIntegration", shareGalleryFunction),
    });

    api.addRoutes({
      path: "/galleries/{id}/uploads",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("InitiateGalleryUploadIntegration", initiateGalleryUploadFunction),
    });

    api.addRoutes({
      path: "/galleries/{id}/uploads/{photoId}/part-url",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("GetGalleryUploadPartUrlIntegration", getGalleryUploadPartUrlFunction),
    });

    api.addRoutes({
      path: "/galleries/{id}/uploads/{photoId}/complete",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CompleteGalleryUploadIntegration", completeGalleryUploadFunction),
    });

    api.addRoutes({
      path: "/studio/spaces",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateStudioSpaceIntegration", createStudioSpaceFunction),
    });

    api.addRoutes({
      path: "/studio/spaces",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListStudioSpacesIntegration", listStudioSpacesFunction),
    });

    api.addRoutes({
      path: "/studio/equipment",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateStudioEquipmentIntegration", createStudioEquipmentFunction),
    });

    api.addRoutes({
      path: "/studio/equipment",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListStudioEquipmentIntegration", listStudioEquipmentFunction),
    });

    api.addRoutes({
      path: "/studio/bookings",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateStudioBookingIntegration", createStudioBookingFunction),
    });

    api.addRoutes({
      path: "/studio/bookings",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListStudioBookingsIntegration", listStudioBookingsFunction),
    });

    api.addRoutes({
      path: "/studio/bookings/{id}",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("GetStudioBookingIntegration", getStudioBookingFunction),
    });

    api.addRoutes({
      path: "/studio/bookings/{id}",
      methods: [apigwv2.HttpMethod.PATCH],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("UpdateStudioBookingIntegration", updateStudioBookingFunction),
    });

    api.addRoutes({
      path: "/studio/calendar",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("GetStudioCalendarIntegration", getStudioCalendarFunction),
    });

    api.addRoutes({
      path: "/invoices",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateInvoiceIntegration", createInvoiceFunction),
    });

    api.addRoutes({
      path: "/invoices",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListInvoicesIntegration", listInvoicesFunction),
    });

    api.addRoutes({
      path: "/invoices/{id}",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("GetInvoiceIntegration", getInvoiceFunction),
    });

    api.addRoutes({
      path: "/invoices/{id}/checkout",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateInvoiceCheckoutIntegration", createInvoiceCheckoutFunction),
    });

    api.addRoutes({
      path: "/payments",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreatePaymentIntegration", createPaymentFunction),
    });

    api.addRoutes({
      path: "/payments",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListPaymentsIntegration", listPaymentsFunction),
    });

    api.addRoutes({
      path: "/payments/provider",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("GetPaymentProviderIntegration", getPaymentProviderFunction),
    });

    api.addRoutes({
      path: "/payments/{id}/refund",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("RefundPaymentIntegration", refundPaymentFunction),
    });

    api.addRoutes({
      path: "/expenses",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateExpenseIntegration", createExpenseFunction),
    });

    api.addRoutes({
      path: "/expenses",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListExpensesIntegration", listExpensesFunction),
    });

    api.addRoutes({
      path: "/expenses/receipt-scans",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateExpenseReceiptScanIntegration", createExpenseReceiptScanFunction),
    });

    api.addRoutes({
      path: "/expenses/receipt-scans/{id}",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("GetExpenseReceiptScanIntegration", getExpenseReceiptScanFunction),
    });

    api.addRoutes({
      path: "/reports/revenue",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("RevenueReportIntegration", revenueReportFunction),
    });

    api.addRoutes({
      path: "/reports/profit",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ProfitReportIntegration", profitReportFunction),
    });

    api.addRoutes({
      path: "/reports/tax-year",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("TaxYearReportIntegration", taxYearReportFunction),
    });

    api.addRoutes({
      path: "/reports/studio-utilization",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration(
        "StudioUtilizationReportIntegration",
        studioUtilizationReportFunction,
      ),
    });

    api.addRoutes({
      path: "/reports/conversion",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ConversionReportIntegration", conversionReportFunction),
    });

    api.addRoutes({
      path: "/reports/turnaround",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("TurnaroundReportIntegration", turnaroundReportFunction),
    });

    api.addRoutes({
      path: "/reports/referrals",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ReferralsReportIntegration", referralsReportFunction),
    });

    api.addRoutes({
      path: "/reports/ltv",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("LtvReportIntegration", ltvReportFunction),
    });

    api.addRoutes({
      path: "/calendar/feed-token",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("IssueCalendarFeedTokenIntegration", issueCalendarFeedTokenFunction),
    });

    api.addRoutes({
      path: "/calendar/feed-token/revoke",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("RevokeCalendarFeedTokenIntegration", revokeCalendarFeedTokenFunction),
    });

    api.addRoutes({
      path: "/calendar.ics",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("CalendarIcsIntegration", calendarIcsFunction),
    });

    api.addRoutes({
      path: "/smart-file-templates",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateSmartFileTemplateIntegration", createSmartFileTemplateFunction),
    });

    api.addRoutes({
      path: "/smart-file-templates",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListSmartFileTemplatesIntegration", listSmartFileTemplatesFunction),
    });

    api.addRoutes({
      path: "/smart-files",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("CreateSmartFileIntegration", createSmartFileFunction),
    });

    api.addRoutes({
      path: "/smart-files",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("ListSmartFilesIntegration", listSmartFilesFunction),
    });

    api.addRoutes({
      path: "/smart-files/{id}",
      methods: [apigwv2.HttpMethod.GET],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("GetSmartFileIntegration", getSmartFileFunction),
    });

    api.addRoutes({
      path: "/smart-files/{id}/send",
      methods: [apigwv2.HttpMethod.POST],
      authorizer: adminAuthorizer,
      integration: new integrations.HttpLambdaIntegration("SendSmartFileIntegration", sendSmartFileFunction),
    });

    api.addRoutes({
      path: "/sign/{token}",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("PublicSmartFileGetIntegration", publicSmartFileGetFunction),
    });

    api.addRoutes({
      path: "/sign/{token}/page",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("PublicSmartFilePageIntegration", publicSmartFilePageFunction),
    });

    api.addRoutes({
      path: "/sign/{token}/payment-intent",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "PublicSmartFilePaymentIntentIntegration",
        publicSmartFilePaymentIntentFunction,
      ),
    });

    api.addRoutes({
      path: "/sign/{token}/request-verification",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration(
        "RequestSmartFileVerificationIntegration",
        requestSmartFileVerificationFunction,
      ),
    });

    api.addRoutes({
      path: "/sign/{token}/submit",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("SubmitSmartFileIntegration", submitSmartFileFunction),
    });

    api.addRoutes({
      path: "/gallery/{token}",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("PublicGalleryGetIntegration", publicGalleryGetFunction),
    });

    api.addRoutes({
      path: "/gallery/{token}/page",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("PublicGalleryPageIntegration", publicGalleryPageFunction),
    });

    api.addRoutes({
      path: "/studio/page",
      methods: [apigwv2.HttpMethod.GET],
      integration: new integrations.HttpLambdaIntegration("PublicStudioPageIntegration", publicStudioPageFunction),
    });

    api.addRoutes({
      path: "/studio/booking-request",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("PublicStudioBookingRequestIntegration", publicStudioBookingRequestFunction),
    });

    api.addRoutes({
      path: "/studio/access/verify",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("PublicStudioAccessVerifyIntegration", publicStudioAccessVerifyFunction),
    });

    api.addRoutes({
      path: "/webhooks/stripe",
      methods: [apigwv2.HttpMethod.POST],
      integration: new integrations.HttpLambdaIntegration("StripeWebhookIntegration", stripeWebhookFunction),
    });

    new events.Rule(this, "InquiryCreatedAutoResponseRule", {
      eventPattern: {
        source: ["studio-os.domain"],
        detailType: ["inquiry.created"],
      },
      targets: [new targets.LambdaFunction(inquiryAutoResponseFunction)],
    });

    this.apiUrl = api.url ?? "";

    new cdk.CfnOutput(this, "ApiUrl", {
      value: this.apiUrl,
      exportName: `${props.stageConfig.prefix}-api-url`,
    });

    new cdk.CfnOutput(this, "HealthUrl", {
      value: `${this.apiUrl}health`,
      exportName: `${props.stageConfig.prefix}-health-url`,
    });

    new cdk.CfnOutput(this, "InboundEmailBucketName", {
      value: inboundEmailBucket.bucketName,
      exportName: `${props.stageConfig.prefix}-inbound-email-bucket`,
    });

    new cdk.CfnOutput(this, "InboundEmailQueueName", {
      value: inboundEmailQueue.queueName,
      exportName: `${props.stageConfig.prefix}-inbound-email-queue`,
    });

    new cdk.CfnOutput(this, "ExpenseReceiptsBucketName", {
      value: expenseReceiptsBucket.bucketName,
      exportName: `${props.stageConfig.prefix}-expense-receipts-bucket`,
    });

    new cdk.CfnOutput(this, "InboundReceiptRuleSetName", {
      value: `${props.stageConfig.prefix}-inbound`,
      exportName: `${props.stageConfig.prefix}-inbound-receipt-rule-set`,
    });

    new cdk.CfnOutput(this, "SesOutboundConfigurationSetName", {
      value: outboundConfigurationSet.configurationSetName,
      exportName: `${props.stageConfig.prefix}-ses-outbound-configuration-set-name`,
    });

    new cdk.CfnOutput(this, "CalendarFeedSecretArn", {
      value: calendarFeedSecret.secretArn,
      exportName: `${props.stageConfig.prefix}-calendar-feed-secret-arn`,
    });

    new cdk.CfnOutput(this, "SmartFileSecretArn", {
      value: smartFileSecret.secretArn,
      exportName: `${props.stageConfig.prefix}-smart-file-secret-arn`,
    });

    new cdk.CfnOutput(this, "GallerySecretArn", {
      value: gallerySecret.secretArn,
      exportName: `${props.stageConfig.prefix}-gallery-secret-arn`,
    });

    new cdk.CfnOutput(this, "SmartFileVerificationTableName", {
      value: smartFileVerificationTable.tableName,
      exportName: `${props.stageConfig.prefix}-smart-file-verification-table-name`,
    });

    new cdk.CfnOutput(this, "SmartFileBucketName", {
      value: smartFileBucket.bucketName,
      exportName: `${props.stageConfig.prefix}-smart-file-bucket-name`,
    });

    new cdk.CfnOutput(this, "SmartFilePdfQueueName", {
      value: smartFilePdfQueue.queueName,
      exportName: `${props.stageConfig.prefix}-smart-file-pdf-queue-name`,
    });
  }
}
