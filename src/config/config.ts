import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

const reviewRuleSchema = z.object({
  id: z.string(),
  criteria: z.string(),
  report: z.string(),
});

const appConfigSchema = z.object({
  projectId: z.number().int().positive(),
  openai: z.object({
    model: z.string(),
    reasoningEffort: z.enum(["none", "low", "medium", "high"]).default("none"),
  }),
  review: z.object({
    rulesVersion: z.string(),
    allowedStages: z.array(z.number().int().nonnegative()),
    batchSize: z.number().int().positive(),
    batchMaxChars: z.number().int().positive(),
    batchMaxRetries: z.number().int().nonnegative(),
    maxStrings: z.number().int().positive().nullable(),
    force: z.boolean(),
    concurrency: z.number().int().positive(),
    exportRetries: z.number().int().positive(),
    exportWaitMs: z.number().int().nonnegative(),
    prefilter: z.object({
      minOriginalLength: z.number().int().nonnegative(),
      minTranslationLength: z.number().int().nonnegative(),
      stripCurlyBraces: z.boolean(),
      requireWordChar: z.boolean(),
      requireChineseInTranslation: z.boolean(),
      skipPunctuationOnly: z.boolean(),
    }),
  }),
  prompts: z.object({
    system: z.string(),
    userTemplate: z.string(),
  }),
  rules: z.array(reviewRuleSchema),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
export type ReviewRule = AppConfig["rules"][number];
export type RuleId = ReviewRule["id"];

export interface LoadAppConfigOptions {
  configJson?: string;
  configPath?: string;
  cwd?: string;
}

let currentAppConfig: AppConfig | null = null;

export function loadAppConfig(options: LoadAppConfigOptions = {}): AppConfig {
  const cwd = options.cwd ?? process.cwd();
  const raw = readConfigText(options, cwd);
  const parsed = appConfigSchema.parse(JSON.parse(raw));
  currentAppConfig = parsed;
  return parsed;
}

export function getAppConfig(): AppConfig {
  if (!currentAppConfig) {
    return loadAppConfig();
  }
  return currentAppConfig;
}

export function setAppConfig(config: AppConfig): void {
  currentAppConfig = config;
}

export function getDefaultConfigPath(cwd = process.cwd()): string {
  return resolve(cwd, "config.json");
}

function readConfigText(options: LoadAppConfigOptions, cwd: string): string {
  if (options.configJson) {
    return options.configJson;
  }

  const configPath = options.configPath
    ? resolve(cwd, options.configPath)
    : getDefaultConfigPath(cwd);

  if (!existsSync(configPath)) {
    throw new Error(`Config file not found: ${configPath}`);
  }

  return readFileSync(configPath, "utf8");
}
