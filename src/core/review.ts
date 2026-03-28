import { OpenAIReviewClient, type ReviewUsage } from "../clients/openai.js";
import type { RuleId } from "../config/rules.js";
import type { NormalizedTerm } from "./terms.js";
import type { ReviewBatch } from "./batching.js";

export interface ReviewedIssue {
  filePath: string;
  key: string;
  original: string;
  translation: string;
  hits: Array<{
    rid: RuleId;
    reason?: string;
  }>;
}

export interface ReviewRunResult {
  issues: ReviewedIssue[];
  usage: ReviewUsage;
  model: string;
}

export async function reviewBatches(input: {
  client: OpenAIReviewClient;
  batches: ReviewBatch[];
  terms: NormalizedTerm[];
  concurrency: number;
}): Promise<ReviewRunResult> {
  const concurrency = Math.max(1, input.concurrency);
  const batchResults: Awaited<ReturnType<typeof processBatch>>[] = [];

  for (let index = 0; index < input.batches.length; index += concurrency) {
    const chunk = input.batches.slice(index, index + concurrency);
    const chunkResults = await Promise.all(
      chunk.map((batch) =>
        processBatch({
          client: input.client,
          batch,
          terms: input.terms,
        }),
      ),
    );
    batchResults.push(...chunkResults);
  }

  const issues = batchResults.flatMap((item) => item.issues);
  const usage: ReviewUsage = {
    inputTokens: batchResults.reduce((sum, item) => sum + item.usage.inputTokens, 0),
    outputTokens: batchResults.reduce((sum, item) => sum + item.usage.outputTokens, 0),
    totalTokens: batchResults.reduce((sum, item) => sum + item.usage.totalTokens, 0),
  };
  const model = batchResults[0]?.model ?? "";

  return {
    issues,
    usage,
    model,
  };
}

async function processBatch(input: {
  client: OpenAIReviewClient;
  batch: ReviewBatch;
  terms: NormalizedTerm[];
}): Promise<{
  issues: ReviewedIssue[];
  usage: ReviewUsage;
  model: string;
}> {
  const result = await input.client.reviewBatch({
    strings: input.batch.strings,
    terms: input.terms,
  });

  const issues: ReviewedIssue[] = [];
  for (const issue of result.issues) {
    const item = input.batch.mappings[issue.key];
    if (!item) {
      continue;
    }

    issues.push({
      filePath: item.filePath,
      key: item.key,
      original: item.original,
      translation: item.translation,
      hits: issue.hits,
    });
  }

  return {
    issues,
    usage: result.usage,
    model: result.model,
  };
}
