import { OpenAIReviewClient } from "../clients/openai.js";
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

export async function reviewBatches(input: {
  client: OpenAIReviewClient;
  batches: ReviewBatch[];
  terms: NormalizedTerm[];
}): Promise<ReviewedIssue[]> {
  const issues: ReviewedIssue[] = [];

  for (const batch of input.batches) {
    const result = await input.client.reviewBatch({
      strings: batch.strings,
      terms: input.terms,
    });

    for (const issue of result.issues) {
      const item = batch.mappings[issue.key];
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
  }

  return issues;
}
