import { OpenAIReviewClient, type ReviewUsage } from "../clients/openai.js";
import type { RuleId } from "../config/rules.js";
import type { ReviewCandidate } from "./batching.js";
import type { NormalizedTerm } from "./terms.js";
import type { ReviewBatch } from "./batching.js";

export interface ReviewedIssue {
  filePath: string;
  key: string;
  original: string;
  translation: string;
  fromCache: boolean;
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
  maxBatchRetries: number;
  onBatchComplete?: (result: {
    batchIndex: number;
    totalBatches: number;
    candidates: ReviewCandidate[];
    issues: ReviewedIssue[];
    skipped: boolean;
    usage: ReviewUsage;
  }) => void;
  onProgress?: (progress: {
    completedBatches: number;
    totalBatches: number;
    completedStrings: number;
    totalStrings: number;
    issueCount: number;
    inputTokens: number;
    outputTokens: number;
    skippedBatches: number;
  }) => void;
}): Promise<ReviewRunResult> {
  const concurrency = Math.max(1, input.concurrency);
  const batchResults: Array<Awaited<ReturnType<typeof processBatch>>> = new Array(
    input.batches.length,
  );
  let completedBatches = 0;
  let completedStrings = 0;
  let issueCount = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let skippedBatches = 0;
  const totalStrings = input.batches.reduce((sum, batch) => sum + batch.strings.length, 0);
  let nextBatchIndex = 0;

  async function runWorker(): Promise<void> {
    while (nextBatchIndex < input.batches.length) {
      const batchIndex = nextBatchIndex;
      nextBatchIndex += 1;

      const batch = input.batches[batchIndex];
      if (!batch) {
        continue;
      }

      const result = await processBatch({
        client: input.client,
        batch,
        terms: input.terms,
        maxBatchRetries: input.maxBatchRetries,
      });

      batchResults[batchIndex] = result;
      completedBatches += 1;
      completedStrings += batch.strings.length;
      issueCount += result.issues.length;
      inputTokens += result.usage.inputTokens;
      outputTokens += result.usage.outputTokens;
      if (result.skipped) {
        skippedBatches += 1;
      }

      input.onBatchComplete?.({
        batchIndex: batchIndex + 1,
        totalBatches: input.batches.length,
        candidates: Object.values(batch.mappings),
        issues: result.issues,
        skipped: result.skipped,
        usage: result.usage,
      });
      input.onProgress?.({
        completedBatches,
        totalBatches: input.batches.length,
        completedStrings,
        totalStrings,
        issueCount,
        inputTokens,
        outputTokens,
        skippedBatches,
      });
    }
  }

  const workerCount = Math.min(concurrency, input.batches.length);
  await Promise.all(Array.from({ length: workerCount }, () => runWorker()));

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
  maxBatchRetries: number;
}): Promise<{
  issues: ReviewedIssue[];
  usage: ReviewUsage;
  model: string;
  skipped: boolean;
}> {
  for (let attempt = 0; attempt <= input.maxBatchRetries; attempt += 1) {
    try {
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
          fromCache: false,
          hits: issue.hits,
        });
      }

      return {
        issues,
        usage: result.usage,
        model: result.model,
        skipped: false,
      };
    } catch (error) {
      const attemptNumber = attempt + 1;
      const maxAttempts = input.maxBatchRetries + 1;
      const sampleKey = input.batch.mappings[input.batch.strings[0]?.key ?? ""]?.key ?? "unknown";
      if (attempt < input.maxBatchRetries) {
        console.warn(
          `Batch retry ${attemptNumber}/${maxAttempts} failed for ${sampleKey}: ${formatError(error)}`,
        );
        continue;
      }
      console.warn(
        `Skipping batch after ${maxAttempts} failed attempts for ${sampleKey}: ${formatError(error)}`,
      );
    }
  }

  return {
    issues: [],
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    },
    model: input.client.getModel(),
    skipped: true,
  };
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
