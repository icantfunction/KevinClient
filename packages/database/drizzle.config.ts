// Stage 2 Drizzle Config Purpose
import type { Config } from "drizzle-kit";

const config: Config = {
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  strict: true,
};

export default config;
