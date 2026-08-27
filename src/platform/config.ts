import { z } from "zod";

const publicConfigSchema = z.object({
  VITE_KASA_API_URL: z.union([z.url(), z.literal("")]).optional(),
  VITE_KASA_COUNTRY: z.string().min(2).max(12).default("demo"),
  VITE_KASA_CURRENCY: z.string().length(3).default("EUR"),
  VITE_KASA_DEMO_MODE: z
    .enum(["true", "false"])
    .default("true")
    .transform((value) => value === "true"),
  VITE_KASA_MAP_TILE_URL: z
    .url()
    .default("https://tile.openstreetmap.org/{z}/{x}/{y}.png"),
});

const parsed = publicConfigSchema.safeParse(import.meta.env);

if (!parsed.success) {
  console.error("Invalid public Kasa configuration", parsed.error.flatten());
  throw new Error(
    "Kasa could not start because its public configuration is invalid.",
  );
}

export const appConfig = {
  apiUrl: parsed.data.VITE_KASA_API_URL || null,
  country: parsed.data.VITE_KASA_COUNTRY,
  currency: parsed.data.VITE_KASA_CURRENCY.toUpperCase(),
  demoMode: parsed.data.VITE_KASA_DEMO_MODE,
  mapTileUrl: parsed.data.VITE_KASA_MAP_TILE_URL,
} as const;

export type AppConfig = typeof appConfig;
