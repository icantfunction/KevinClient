// Stage 6 Media Stack Purpose
import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import * as appscaling from "aws-cdk-lib/aws-applicationautoscaling";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as ecs from "aws-cdk-lib/aws-ecs";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import * as nodejs from "aws-cdk-lib/aws-lambda-nodejs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as s3n from "aws-cdk-lib/aws-s3-notifications";
import * as s3assets from "aws-cdk-lib/aws-s3-assets";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";
import { StudioOsStageConfig } from "../config/stage-config";
import { StudioOsDataStack } from "./data-stack";
import { buildGalleryOriginalsBackupBucketName } from "./media-backup-stack";
import { StudioOsNetworkStack } from "./network-stack";

export type StudioOsMediaStackProps = cdk.StackProps & {
  readonly stageConfig: StudioOsStageConfig;
  readonly network: StudioOsNetworkStack;
  readonly data: StudioOsDataStack;
};

const resolveLogRetention = (days: number): logs.RetentionDays =>
  days <= 7 ? logs.RetentionDays.ONE_WEEK : logs.RetentionDays.TWO_WEEKS;

const bootstrapPackages = [
  "sharp@0.34.4",
  "exifr@7.1.3",
  "@aws-sdk/client-s3@3.1032.0",
  "@aws-sdk/client-sqs@3.1032.0",
  "@aws-sdk/client-eventbridge@3.1032.0",
  "@aws-sdk/client-rds-data@3.1032.0",
  "@aws-sdk/client-rekognition@3.1032.0",
  "@aws-sdk/client-secrets-manager@3.1032.0",
].join(" ");

const buildBootstrapCommand = () =>
  [
    "set -euo pipefail",
    "mkdir -p /workspace",
    "cd /workspace",
    "if [ ! -f package.json ]; then npm init -y >/dev/null 2>&1; fi",
    `npm install --no-fund --no-audit ${bootstrapPackages} >/tmp/studio-os-image-processor-npm.log 2>&1`,
    `node -e "const fs=require('fs'); const {S3Client,GetObjectCommand}=require('@aws-sdk/client-s3'); (async()=>{ const client=new S3Client({region:process.env.AWS_REGION}); const response=await client.send(new GetObjectCommand({Bucket:process.env.STUDIO_OS_IMAGE_PROCESSOR_ASSET_BUCKET,Key:process.env.STUDIO_OS_IMAGE_PROCESSOR_ASSET_KEY})); const body=await response.Body.transformToString(); fs.writeFileSync('/workspace/image-processor.mjs', body); })().catch((error)=>{ console.error(error); process.exit(1); });"`,
    "node /workspace/image-processor.mjs",
  ].join(" && ");

export class StudioOsMediaStack extends cdk.Stack {
  public readonly galleryOriginalsBucket: s3.Bucket;
  public readonly galleryDerivativesBucket: s3.Bucket;
  public readonly galleryIngressQueue: sqs.Queue;
  public readonly galleryPublicDistribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props: StudioOsMediaStackProps) {
    super(scope, id, props);

    const applicationLogRetention = resolveLogRetention(props.stageConfig.logRetentionDays.application);
    const projectRoot = path.resolve(__dirname, "../../..");
    const account = props.env?.account ?? cdk.Stack.of(this).account;
    const backupBucketName = buildGalleryOriginalsBackupBucketName(props.stageConfig.prefix, account);
    const backupBucketArn = `arn:aws:s3:::${backupBucketName}`;

    this.galleryOriginalsBucket = new s3.Bucket(this, "GalleryOriginalsBucket", {
      bucketName: `${props.stageConfig.prefix}-gallery-originals-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      transferAcceleration: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    this.galleryDerivativesBucket = new s3.Bucket(this, "GalleryDerivativesBucket", {
      bucketName: `${props.stageConfig.prefix}-gallery-derivatives-${this.account}`,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    const replicationRole = new iam.Role(this, "GalleryOriginalReplicationRole", {
      assumedBy: new iam.ServicePrincipal("s3.amazonaws.com"),
    });

    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:GetReplicationConfiguration",
          "s3:ListBucket",
          "s3:GetObjectVersionForReplication",
          "s3:GetObjectVersionAcl",
          "s3:GetObjectVersionTagging",
          "s3:GetObjectRetention",
          "s3:GetObjectLegalHold",
        ],
        resources: [this.galleryOriginalsBucket.bucketArn, `${this.galleryOriginalsBucket.bucketArn}/*`],
      }),
    );
    replicationRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:ReplicateObject",
          "s3:ReplicateDelete",
          "s3:ReplicateTags",
          "s3:ObjectOwnerOverrideToBucketOwner",
        ],
        resources: [`${backupBucketArn}/*`],
      }),
    );

    const originalsBucketResource = this.galleryOriginalsBucket.node.defaultChild as s3.CfnBucket;
    originalsBucketResource.replicationConfiguration = {
      role: replicationRole.roleArn,
      rules: [
        {
          id: "replicate-gallery-originals",
          priority: 1,
          status: "Enabled",
          deleteMarkerReplication: {
            status: "Disabled",
          },
          filter: {
            prefix: "galleries/",
          },
          destination: {
            bucket: backupBucketArn,
            storageClass: "STANDARD",
          },
        },
      ],
    };

    const galleryIngressDlq = new sqs.Queue(this, "GalleryIngressDlq", {
      queueName: `${props.stageConfig.prefix}-gallery-ingest-dlq.fifo`,
      fifo: true,
      retentionPeriod: cdk.Duration.days(14),
      enforceSSL: true,
    });

    this.galleryIngressQueue = new sqs.Queue(this, "GalleryIngressQueue", {
      queueName: `${props.stageConfig.prefix}-gallery-ingest.fifo`,
      fifo: true,
      contentBasedDeduplication: false,
      visibilityTimeout: cdk.Duration.minutes(5),
      receiveMessageWaitTime: cdk.Duration.seconds(20),
      deadLetterQueue: {
        queue: galleryIngressDlq,
        maxReceiveCount: 3,
      },
      enforceSSL: true,
    });

    const workerAsset = new s3assets.Asset(this, "ImageProcessorWorkerAsset", {
      path: path.join(projectRoot, "infra", "workers", "image-processor.mjs"),
    });

    const createNodeFunction = (name: string, entry: string, environment?: Record<string, string>) =>
      new nodejs.NodejsFunction(this, name, {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry,
        handler: "handler",
        timeout: cdk.Duration.seconds(30),
        memorySize: 512,
        logRetention: applicationLogRetention,
        depsLockFilePath: path.join(projectRoot, "pnpm-lock.yaml"),
        bundling: {
          target: "node20",
          format: nodejs.OutputFormat.CJS,
        },
        environment: {
          STAGE_NAME: props.stageConfig.stageName,
          STUDIO_OS_DATABASE_NAME: props.stageConfig.databaseName,
          STUDIO_OS_DATABASE_RESOURCE_ARN: props.data.cluster.clusterArn,
          STUDIO_OS_DATABASE_SECRET_ARN: props.data.cluster.secret!.secretArn,
          STUDIO_OS_EVENT_BUS_NAME: "default",
          ...environment,
        },
      });

    const galleryIngestRouterFunction = createNodeFunction("GalleryIngestRouterFunction", "lambda/gallery-ingest-router/index.ts", {
      STUDIO_OS_GALLERY_INGRESS_QUEUE_URL: this.galleryIngressQueue.queueUrl,
    });

    const galleryPhotoProcessedUpdaterFunction = createNodeFunction(
      "GalleryPhotoProcessedUpdaterFunction",
      "lambda/events-gallery-photo-processed/index.ts",
    );

    this.galleryOriginalsBucket.addEventNotification(
      s3.EventType.OBJECT_CREATED,
      new s3n.LambdaDestination(galleryIngestRouterFunction),
      { prefix: "galleries/" },
    );

    props.data.cluster.grantDataApiAccess(galleryPhotoProcessedUpdaterFunction);
    this.galleryIngressQueue.grantSendMessages(galleryIngestRouterFunction);
    galleryIngestRouterFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [`arn:aws:events:${this.region}:${this.account}:event-bus/default`],
      }),
    );
    galleryPhotoProcessedUpdaterFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [`arn:aws:events:${this.region}:${this.account}:event-bus/default`],
      }),
    );

    new events.Rule(this, "PhotoProcessedGalleryUpdaterRule", {
      eventPattern: {
        source: ["studio-os.domain"],
        detailType: ["photo.processed"],
      },
      targets: [new targets.LambdaFunction(galleryPhotoProcessedUpdaterFunction)],
    });

    this.galleryPublicDistribution = new cloudfront.Distribution(this, "GalleryPublicDistribution", {
      defaultBehavior: {
        origin: new origins.S3Origin(this.galleryDerivativesBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      comment: "Stage 6 gallery derivatives distribution.",
    });

    const cluster = new ecs.Cluster(this, "MediaCluster", {
      vpc: props.network.vpc,
      clusterName: `${props.stageConfig.prefix}-media`,
      containerInsightsV2: ecs.ContainerInsights.ENABLED,
    });

    const taskDefinition = new ecs.FargateTaskDefinition(this, "ImageProcessorTaskDefinition", {
      cpu: 2048,
      memoryLimitMiB: 4096,
      ephemeralStorageGiB: 21,
    });

    workerAsset.grantRead(taskDefinition.taskRole);
    this.galleryOriginalsBucket.grantRead(taskDefinition.taskRole);
    this.galleryDerivativesBucket.grantReadWrite(taskDefinition.taskRole);
    this.galleryIngressQueue.grantConsumeMessages(taskDefinition.taskRole);
    props.data.cluster.grantDataApiAccess(taskDefinition.taskRole);
    taskDefinition.taskRole.addToPrincipalPolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents", "rekognition:DetectLabels", "rekognition:DetectFaces"],
        resources: ["*"],
      }),
    );

    const logGroup = new logs.LogGroup(this, "ImageProcessorLogGroup", {
      retention: applicationLogRetention,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    taskDefinition.addContainer("ImageProcessorContainer", {
      image: ecs.ContainerImage.fromRegistry("public.ecr.aws/docker/library/node:20-bookworm-slim"),
      essential: true,
      logging: ecs.LogDriver.awsLogs({
        logGroup,
        streamPrefix: "image-processor",
      }),
      environment: {
        STUDIO_OS_DATABASE_NAME: props.stageConfig.databaseName,
        STUDIO_OS_DATABASE_RESOURCE_ARN: props.data.cluster.clusterArn,
        STUDIO_OS_DATABASE_SECRET_ARN: props.data.cluster.secret!.secretArn,
        STUDIO_OS_EVENT_BUS_NAME: "default",
        STUDIO_OS_GALLERY_INGRESS_QUEUE_URL: this.galleryIngressQueue.queueUrl,
        STUDIO_OS_GALLERY_ORIGINALS_BUCKET_NAME: this.galleryOriginalsBucket.bucketName,
        STUDIO_OS_GALLERY_DERIVATIVES_BUCKET_NAME: this.galleryDerivativesBucket.bucketName,
        STUDIO_OS_IMAGE_PROCESSOR_ASSET_BUCKET: workerAsset.s3BucketName,
        STUDIO_OS_IMAGE_PROCESSOR_ASSET_KEY: workerAsset.s3ObjectKey,
      },
      command: ["bash", "-lc", buildBootstrapCommand()],
    });

    const serviceSecurityGroup = new ec2.SecurityGroup(this, "ImageProcessorServiceSecurityGroup", {
      vpc: props.network.vpc,
      allowAllOutbound: true,
      description: "Stage 6 image processor outbound-only access.",
    });

    const service = new ecs.FargateService(this, "ImageProcessorService", {
      cluster,
      taskDefinition,
      desiredCount: 0,
      assignPublicIp: true,
      serviceName: `${props.stageConfig.prefix}-image-processor`,
      securityGroups: [serviceSecurityGroup],
      vpcSubnets: {
        subnetType: ec2.SubnetType.PUBLIC,
      },
      circuitBreaker: {
        rollback: true,
      },
    });

    const backlogMetric = new cloudwatch.MathExpression({
      expression: "visible + inflight",
      usingMetrics: {
        visible: this.galleryIngressQueue.metricApproximateNumberOfMessagesVisible(),
        inflight: this.galleryIngressQueue.metricApproximateNumberOfMessagesNotVisible(),
      },
      period: cdk.Duration.minutes(1),
    });

    const scalableTarget = service.autoScaleTaskCount({
      minCapacity: 0,
      maxCapacity: 5,
    });

    scalableTarget.scaleOnMetric("GalleryIngressBacklogScaling", {
      metric: backlogMetric,
      adjustmentType: appscaling.AdjustmentType.CHANGE_IN_CAPACITY,
      cooldown: cdk.Duration.seconds(60),
      scalingSteps: [
        { upper: 0, change: -1 },
        { lower: 1, change: +1 },
        { lower: 50, change: +2 },
        { lower: 150, change: +3 },
      ],
    });

    new cdk.CfnOutput(this, "GalleryOriginalsBucketName", {
      value: this.galleryOriginalsBucket.bucketName,
      exportName: `${props.stageConfig.prefix}-gallery-originals-bucket-name`,
    });

    new cdk.CfnOutput(this, "GalleryDerivativesBucketName", {
      value: this.galleryDerivativesBucket.bucketName,
      exportName: `${props.stageConfig.prefix}-gallery-derivatives-bucket-name`,
    });

    new cdk.CfnOutput(this, "GalleryIngressQueueName", {
      value: this.galleryIngressQueue.queueName,
      exportName: `${props.stageConfig.prefix}-gallery-ingress-queue-name`,
    });

    new cdk.CfnOutput(this, "GalleryDistributionDomainName", {
      value: this.galleryPublicDistribution.domainName,
      exportName: `${props.stageConfig.prefix}-gallery-distribution-domain-name`,
    });
  }
}
