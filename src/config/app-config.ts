import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const ruleIdSchema = z.enum(["R1", "R2", "R3", "R4", "R5"]);
const severitySchema = z.enum(["error"]);
const categorySchema = z.enum([
  "typo",
  "duplicate_text",
  "term_mismatch",
  "source_target_mismatch",
  "other",
]);

const appConfigSchema = z.object({
  openai: z.object({
    model: z.string().min(1),
  }),
  review: z.object({
    rulesVersion: z.string().min(1),
    batchSize: z.number().int().positive(),
    exportRetries: z.number().int().positive(),
    exportWaitMs: z.number().int().positive(),
    prefilter: z.object({
      minOriginalLength: z.number().int().nonnegative(),
      minTranslationLength: z.number().int().nonnegative(),
      requireWordChar: z.boolean(),
      skipPunctuationOnly: z.boolean(),
    }),
  }),
  prompts: z.object({
    system: z.string().min(1),
    userTemplate: z.string().min(1),
  }),
  rules: z.array(
    z.object({
      id: ruleIdSchema,
      desc: z.string().min(1),
      severity: severitySchema,
      category: categorySchema,
    }),
  ),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type RuleId = z.infer<typeof ruleIdSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Category = z.infer<typeof categorySchema>;

export function loadAppConfig(configPath = join(process.cwd(), "config.json")): AppConfig {
  const raw = readFileSync(configPath, "utf8");
  return appConfigSchema.parse(JSON.parse(raw));
}

export const APP_CONFIG = loadAppConfig();
