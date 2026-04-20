// Stage 1 CDK App Purpose
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { StudioOsStageConfig, resolveStageConfig } from "../lib/config/stage-config";
import { StudioOsApiStack } from "../lib/stacks/api-stack";
import { StudioOsAuthStack } from "../lib/stacks/auth-stack";
import { StudioOsDataStack } from "../lib/stacks/data-stack";
import { StudioOsEventsStack } from "../lib/stacks/events-stack";
import { StudioOsMediaBackupStack } from "../lib/stacks/media-backup-stack";
import { StudioOsMediaStack } from "../lib/stacks/media-stack";
import { StudioOsNetworkStack } from "../lib/stacks/network-stack";

const app = new cdk.App();
const stageConfig: StudioOsStageConfig = resolveStageConfig();
const environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION ?? stageConfig.region,
};

const networkStack = new StudioOsNetworkStack(app, `${stageConfig.prefix}-network`, {
  env: environment,
  stageConfig,
});

const authStack = new StudioOsAuthStack(app, `${stageConfig.prefix}-auth`, {
  env: environment,
  stageConfig,
  network: networkStack,
});

authStack.addDependency(networkStack);

const dataStack = new StudioOsDataStack(app, `${stageConfig.prefix}-data`, {
  env: environment,
  stageConfig,
  network: networkStack,
});

dataStack.addDependency(networkStack);

const mediaBackupStack = new StudioOsMediaBackupStack(app, `${stageConfig.prefix}-media-backup`, {
  env: {
    account: environment.account,
    region: "us-west-2",
  },
  stageConfig,
});

const mediaStack = new StudioOsMediaStack(app, `${stageConfig.prefix}-media`, {
  env: environment,
  stageConfig,
  network: networkStack,
  data: dataStack,
});

mediaStack.addDependency(networkStack);
mediaStack.addDependency(dataStack);
mediaStack.addDependency(mediaBackupStack);

const apiStack = new StudioOsApiStack(app, `${stageConfig.prefix}-api`, {
  env: environment,
  stageConfig,
  auth: authStack,
  data: dataStack,
  media: mediaStack,
});

apiStack.addDependency(authStack);
apiStack.addDependency(dataStack);
apiStack.addDependency(mediaStack);

const eventsStack = new StudioOsEventsStack(app, `${stageConfig.prefix}-events`, {
  env: environment,
  stageConfig,
  api: apiStack,
  data: dataStack,
});

eventsStack.addDependency(apiStack);
eventsStack.addDependency(dataStack);

cdk.Tags.of(app).add("Project", "KevinStudioOS");
cdk.Tags.of(app).add("Stage", stageConfig.stageName);
