import OpenAI from "openai";
import { z } from "zod";
import { getAppConfig, type RuleId } from "../config/config.js";
import { getReviewRules } from "../config/rules.js";

export interface OpenAIReviewString {
  key: string;
  o: string;
  t: string;
}

function buildUserPrompt(input: {
  strings: OpenAIReviewString[];
  terms: Array<{ term: string; translation: string; note?: string; variants?: string[] }>;
}): string {
  const config = getAppConfig();
  const reviewRules = getReviewRules();
  const rulesJson = JSON.stringify(
    reviewRules.map(({ id, criteria, report }) => ({ id, criteria, report })),
  );
  const termsJson = JSON.stringify(input.terms);
  const stringsJson = JSON.stringify(input.strings);

  return config.prompts.userTemplate
    .replace("{{RULES_JSON}}", rulesJson)
    .replace("{{TERMS_JSON}}", termsJson)
    .replace("{{STRINGS_JSON}}", stringsJson);
}

export interface OpenAIReviewClientOptions {
  apiKey: string;
  model: string;
  reasoningEffort: "none" | "low" | "medium" | "high";
}

export interface ReviewUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ReviewBatchResult {
  issues: Array<{
    key: string;
    hits: Array<{
      rid: RuleId;
      reason?: string;
    }>;
  }>;
  usage: ReviewUsage;
  model: string;
}

export class OpenAIReviewClient {
  private readonly client: OpenAI;
  private readonly model: string;
  private readonly reasoningEffort: OpenAIReviewClientOptions["reasoningEffort"];

  constructor(options: OpenAIReviewClientOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model;
    this.reasoningEffort = options.reasoningEffort;
  }

  async reviewBatch(input: {
    strings: OpenAIReviewString[];
    terms: Array<{ term: string; translation: string; note?: string; variants?: string[] }>;
  }): Promise<ReviewBatchResult> {
    const responseSchema = buildReviewResponseSchema();
    const response = await this.client.responses.create({
      model: this.model,
      instructions: getAppConfig().prompts.system,
      input: buildUserPrompt(input),
      reasoning:
        this.reasoningEffort === "none"
          ? undefined
          : {
              effort: this.reasoningEffort,
            },
    });

    const raw = response.output_text.trim();
    const parsed = responseSchema.parse(JSON.parse(raw));

    return {
      issues: parsed.issues,
      model: this.model,
      usage: {
        inputTokens: response.usage?.input_tokens ?? 0,
        outputTokens: response.usage?.output_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
      },
    };
  }

  static hitIds(): string[] {
    return getReviewRules().map((rule) => rule.id);
  }

  getModel(): string {
    return this.model;
  }
}

function buildReviewResponseSchema() {
  const validRuleIds = new Set(getReviewRules().map((rule) => rule.id));

  const hitSchema = z.object({
    rid: z
      .string()
      .refine((value): value is RuleId => validRuleIds.has(value as RuleId), "Invalid rule id"),
    reason: z.string().optional(),
  });

  const issueSchema = z.object({
    key: z.string(),
    hits: z.array(hitSchema),
  });

  return z.object({
    issues: z.array(issueSchema),
  });
}
