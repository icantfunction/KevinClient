// Stage 2 Data Stack Purpose
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as rds from "aws-cdk-lib/aws-rds";
import * as ssm from "aws-cdk-lib/aws-ssm";
import { Construct } from "constructs";
import { StudioOsStageConfig } from "../config/stage-config";
import { StudioOsNetworkStack } from "./network-stack";

export type StudioOsDataStackProps = cdk.StackProps & {
  readonly stageConfig: StudioOsStageConfig;
  readonly network: StudioOsNetworkStack;
};

export class StudioOsDataStack extends cdk.Stack {
  public readonly cluster: rds.DatabaseCluster;
  public readonly idempotencyTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props: StudioOsDataStackProps) {
    super(scope, id, props);

    const { stageConfig, network } = props;

    this.cluster = new rds.DatabaseCluster(this, "AuroraCluster", {
      clusterIdentifier: `${stageConfig.prefix}-aurora`,
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: rds.AuroraPostgresEngineVersion.VER_16_6,
      }),
      credentials: rds.Credentials.fromGeneratedSecret("studio_os_admin", {
        secretName: `${stageConfig.prefix}/data/cluster-admin`,
      }),
      defaultDatabaseName: stageConfig.databaseName,
      writer: rds.ClusterInstance.serverlessV2("writer"),
      serverlessV2MinCapacity: 0,
      serverlessV2MaxCapacity: 1,
      enableDataApi: true,
      vpc: network.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [network.databaseSecurityGroup],
      backup: {
        retention: cdk.Duration.days(7),
      },
      copyTagsToSnapshot: true,
      storageEncrypted: true,
      iamAuthentication: true,
      deletionProtection: false,
      removalPolicy: cdk.RemovalPolicy.SNAPSHOT,
    });

    this.idempotencyTable = new dynamodb.Table(this, "IdempotencyTable", {
      tableName: `${stageConfig.prefix}-idempotency`,
      partitionKey: {
        name: "idempotency_key",
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      timeToLiveAttribute: "expires_at",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new ssm.StringParameter(this, "DatabaseNameParameter", {
      parameterName: `/${stageConfig.prefix}/database/name`,
      stringValue: stageConfig.databaseName,
    });

    new ssm.StringParameter(this, "DatabaseClusterArnParameter", {
      parameterName: `/${stageConfig.prefix}/database/resource-arn`,
      stringValue: this.cluster.clusterArn,
    });

    new ssm.StringParameter(this, "DatabaseSecretArnParameter", {
      parameterName: `/${stageConfig.prefix}/database/secret-arn`,
      stringValue: this.cluster.secret!.secretArn,
    });

    new ssm.StringParameter(this, "EventBusNameParameter", {
      parameterName: `/${stageConfig.prefix}/events/default-bus-name`,
      stringValue: "default",
    });

    new cdk.CfnOutput(this, "DatabaseName", {
      value: stageConfig.databaseName,
      exportName: `${stageConfig.prefix}-database-name`,
    });

    new cdk.CfnOutput(this, "DatabaseClusterArn", {
      value: this.cluster.clusterArn,
      exportName: `${stageConfig.prefix}-database-cluster-arn`,
    });

    new cdk.CfnOutput(this, "DatabaseSecretArn", {
      value: this.cluster.secret!.secretArn,
      exportName: `${stageConfig.prefix}-database-secret-arn`,
    });

    new cdk.CfnOutput(this, "IdempotencyTableName", {
      value: this.idempotencyTable.tableName,
      exportName: `${stageConfig.prefix}-idempotency-table-name`,
    });

    new cdk.CfnOutput(this, "EventBusName", {
      value: "default",
      exportName: `${stageConfig.prefix}-event-bus-name`,
    });
  }
}
