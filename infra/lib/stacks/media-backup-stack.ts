// Stage 6 Media Backup Stack Purpose
import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import { Construct } from "constructs";
import { StudioOsStageConfig } from "../config/stage-config";

export type StudioOsMediaBackupStackProps = cdk.StackProps & {
  readonly stageConfig: StudioOsStageConfig;
};

export const buildGalleryOriginalsBackupBucketName = (prefix: string, account: string) =>
  `${prefix}-gallery-originals-west-2-${account}`;

export class StudioOsMediaBackupStack extends cdk.Stack {
  public readonly backupBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: StudioOsMediaBackupStackProps) {
    super(scope, id, props);

    const account = props.env?.account ?? cdk.Stack.of(this).account;

    this.backupBucket = new s3.Bucket(this, "GalleryOriginalsBackupBucket", {
      bucketName: buildGalleryOriginalsBackupBucketName(props.stageConfig.prefix, account),
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      enforceSSL: true,
      lifecycleRules: [
        {
          transitions: [
            {
              storageClass: s3.StorageClass.DEEP_ARCHIVE,
              transitionAfter: cdk.Duration.days(90),
            },
          ],
        },
      ],
      removalPolicy: cdk.RemovalPolicy.RETAIN,
    });

    new cdk.CfnOutput(this, "GalleryOriginalsBackupBucketName", {
      value: this.backupBucket.bucketName,
      exportName: `${props.stageConfig.prefix}-gallery-originals-backup-bucket-name`,
    });
  }
}
