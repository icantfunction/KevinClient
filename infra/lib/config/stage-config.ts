// Stage 1 Stage Config Purpose
export type StudioOsStageConfig = {
  readonly stageName: string;
  readonly prefix: string;
  readonly region: string;
  readonly allowedPhoneNumber: string;
  readonly adminAppOrigins: string[];
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

const defaultAdminAppOrigins = [
  "https://main.d2pc7jrka8vz5q.amplifyapp.com",
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:3001",
];

const resolveAdminAppOrigins = () => {
  const configuredOrigins = readCommaSeparatedList(process.env.STUDIO_OS_ADMIN_APP_ORIGINS);
  return configuredOrigins.length > 0 ? configuredOrigins : defaultAdminAppOrigins;
};

export const resolveStageConfig = (): StudioOsStageConfig => ({
  stageName: "stage-1",
  prefix: "studio-os-stage-1",
  region: "us-east-1",
  allowedPhoneNumber: "+19548541484",
  adminAppOrigins: resolveAdminAppOrigins(),
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
