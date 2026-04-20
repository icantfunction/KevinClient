// Stage 1 Network Stack Purpose
import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import { Construct } from "constructs";
import { StudioOsStageConfig } from "../config/stage-config";

export type StudioOsNetworkStackProps = cdk.StackProps & {
  readonly stageConfig: StudioOsStageConfig;
};

export class StudioOsNetworkStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly databaseSecurityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: StudioOsNetworkStackProps) {
    super(scope, id, props);

    this.vpc = new ec2.Vpc(this, "Vpc", {
      ipAddresses: ec2.IpAddresses.cidr("10.20.0.0/16"),
      maxAzs: 2,
      natGateways: 0,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "isolated",
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
        },
      ],
    });

    this.databaseSecurityGroup = new ec2.SecurityGroup(this, "DatabaseSecurityGroup", {
      vpc: this.vpc,
      description: "Aurora security group for future Studio OS data plane resources.",
      allowAllOutbound: false,
    });

    new cdk.CfnOutput(this, "VpcId", {
      value: this.vpc.vpcId,
      exportName: `${props.stageConfig.prefix}-vpc-id`,
    });

    new cdk.CfnOutput(this, "PublicSubnetIds", {
      value: this.vpc.publicSubnets.map((subnet) => subnet.subnetId).join(","),
      exportName: `${props.stageConfig.prefix}-public-subnet-ids`,
    });

    new cdk.CfnOutput(this, "IsolatedSubnetIds", {
      value: this.vpc.isolatedSubnets.map((subnet) => subnet.subnetId).join(","),
      exportName: `${props.stageConfig.prefix}-isolated-subnet-ids`,
    });
  }
}
