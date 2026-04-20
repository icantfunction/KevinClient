// Stage 1 Health Lambda Purpose
export const handler = async () => ({
  statusCode: 200,
  headers: {
    "content-type": "application/json",
  },
  body: JSON.stringify({
    ok: true,
    service: "studio-os-api",
    stage: process.env.STAGE_NAME ?? "unknown",
    timestamp: new Date().toISOString(),
  }),
});
