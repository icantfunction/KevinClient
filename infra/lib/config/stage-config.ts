// Stage 1 Stage Config Purpose
export type StudioOsStageConfig = {
  readonly stageName: string;
  readonly prefix: string;
  readonly region: string;
  readonly allowedPhoneNumber: string;
  readonly databaseName: string;
  readonly timezone: string;
  readonly sesFromEmail: string;
  readonly sesConfigurationSetName: string;
  readonly sesInboundRecipients: string[];
  readonly logRetentionDays: {
    readonly access: number;
    readonly application: number;
  };
};

const readCommaSeparatedList = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

export const resolveStageConfig = (): StudioOsStageConfig => ({
  stageName: "stage-1",
  prefix: "studio-os-stage-1",
  region: "us-east-1",
  allowedPhoneNumber: "+19548541484",
  databaseName: "studio_os",
  timezone: "America/New_York",
  sesFromEmail: process.env.STUDIO_OS_SES_FROM_EMAIL ?? "",
  sesConfigurationSetName: process.env.STUDIO_OS_SES_CONFIGURATION_SET_NAME ?? "studio-os-outbound",
  sesInboundRecipients: readCommaSeparatedList(process.env.STUDIO_OS_SES_INBOUND_RECIPIENTS),
  logRetentionDays: {
    access: 7,
    application: 14,
  },
});
