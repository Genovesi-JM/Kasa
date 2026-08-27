import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: process.env.KASA_API_ENV_FILE || ".env.api", quiet: true });

const envSchema = z.object({
  KASA_API_PORT: z.coerce.number().int().min(1024).max(65535).default(8787),
  KASA_API_HOST: z.string().default("127.0.0.1"),
  KASA_API_ALLOWED_ORIGINS: z
    .string()
    .default("http://127.0.0.1:5173,http://localhost:5173"),
  KASA_API_DEMO_WRITES: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  KASA_API_DEMO_KEY: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().min(16).optional(),
  ),
  KASA_API_COUNTRY: z.string().min(2).max(12).default("demo"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid Kasa API configuration", parsed.error.flatten());
  process.exit(1);
}

export const apiConfig = {
  port: parsed.data.KASA_API_PORT,
  host: parsed.data.KASA_API_HOST,
  allowedOrigins: parsed.data.KASA_API_ALLOWED_ORIGINS.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  demoWrites: parsed.data.KASA_API_DEMO_WRITES,
  demoKey: parsed.data.KASA_API_DEMO_KEY,
  country: parsed.data.KASA_API_COUNTRY,
} as const;

if (apiConfig.demoWrites && !apiConfig.demoKey) {
  console.error(
    "KASA_API_DEMO_KEY is required when KASA_API_DEMO_WRITES=true.",
  );
  process.exit(1);
}
