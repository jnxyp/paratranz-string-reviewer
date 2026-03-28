import OpenAI from "openai";
import { z } from "zod";
import { APP_CONFIG } from "../config/app-config.js";
import { REVIEW_RULES, type RuleId } from "../config/rules.js";

const validRuleIds = new Set(REVIEW_RULES.map((rule) => rule.id));

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

const reviewResponseSchema = z.object({
  issues: z.array(issueSchema),
});

export type ReviewResponse = z.infer<typeof reviewResponseSchema>;

export interface OpenAIReviewString {
  key: string;
  o: string;
  t: string;
}

const SYSTEM_PROMPT = APP_CONFIG.prompts.system;

function buildUserPrompt(input: {
  strings: OpenAIReviewString[];
  terms: Array<{ term: string; translation: string; note?: string; variants?: string[] }>;
}): string {
  const rulesJson = JSON.stringify(
    REVIEW_RULES.map(({ id, desc }) => ({ id, desc })),
  );
  const termsJson = JSON.stringify(input.terms);
  const stringsJson = JSON.stringify(input.strings);

  return APP_CONFIG.prompts.userTemplate
    .replace("{{RULES_JSON}}", rulesJson)
    .replace("{{TERMS_JSON}}", termsJson)
    .replace("{{STRINGS_JSON}}", stringsJson);
}

export interface OpenAIReviewClientOptions {
  apiKey: string;
  model: string;
}

export class OpenAIReviewClient {
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(options: OpenAIReviewClientOptions) {
    this.client = new OpenAI({ apiKey: options.apiKey });
    this.model = options.model;
  }

  async reviewBatch(input: {
    strings: OpenAIReviewString[];
    terms: Array<{ term: string; translation: string; note?: string; variants?: string[] }>;
  }): Promise<ReviewResponse> {
    const response = await this.client.responses.create({
      model: this.model,
      instructions: SYSTEM_PROMPT,
      input: buildUserPrompt(input),
    });

    const raw = response.output_text.trim();
    return reviewResponseSchema.parse(JSON.parse(raw));
  }

  static schema = reviewResponseSchema;
  static hitIds = REVIEW_RULES.map((rule) => rule.id) as RuleId[];
}
