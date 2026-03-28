import OpenAI from "openai";
import { z } from "zod";
import { REVIEW_RULES, type RuleId } from "../config/rules.js";

const hitSchema = z.object({
  rid: z.enum(["R1", "R2", "R3", "R4", "R5"]),
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

const SYSTEM_PROMPT = `你是一个中文翻译审核助手。

输入包含：
- 审核规则
- 术语表
- 一批翻译词条

你的任务是找出有问题的词条，并按规则 ID 返回命中结果。

输出要求：
- 只输出有问题的词条
- 输出合法 JSON
- 输出字段尽量短`;

function buildUserPrompt(input: {
  strings: OpenAIReviewString[];
  terms: Array<{ term: string; translation: string; note?: string; variants?: string[] }>;
}): string {
  const rulesJson = JSON.stringify(
    REVIEW_RULES.map(({ id, desc }) => ({ id, desc })),
  );
  const termsJson = JSON.stringify(input.terms);
  const stringsJson = JSON.stringify(input.strings);

  return `请审核下面这批翻译词条。

【任务】
- 只输出有问题的词条
- 输入中的 key 是短编号，仅用于定位
- 词条已经按 key 排序
- 按规则 ID 返回命中结果

【规则】
${rulesJson}

【术语表】
${termsJson}

【输出格式】
- 输出必须是 JSON 对象
- 顶层字段固定为 issues
- 如果没有问题，返回 {"issues":[]}
- 每个 issue 只包含 key 和 hits
- hits 是对象数组
- 每个 hit 包含 rid
- 每个 hit 可选包含 reason
- reason 尽量简短

【词条】
${stringsJson}`;
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
