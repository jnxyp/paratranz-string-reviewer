import { config as loadDotenv } from "dotenv";
import { z } from "zod";

loadDotenv({ quiet: true });

const envSchema = z.object({
  PARATRANZ_API_KEY: z.string().min(1),
  OPENAI_API_KEY: z.string().min(1).optional(),
});

export type AppEnv = z.infer<typeof envSchema>;

export function loadEnv(): AppEnv {
  return envSchema.parse({
    PARATRANZ_API_KEY: process.env.PARATRANZ_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  });
}
