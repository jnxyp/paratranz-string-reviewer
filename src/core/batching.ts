import { buildStringHash, type CacheFile } from "./cache.js";
import { APP_CONFIG } from "../config/config.js";
import type { ParsedString } from "./parse.js";

export interface ReviewCandidate extends ParsedString {
  hash: string;
}

export interface ReviewBatchItem {
  key: string;
  o: string;
  t: string;
}

export interface ReviewBatch {
  mappings: Record<string, ReviewCandidate>;
  strings: ReviewBatchItem[];
}

export function buildReviewCandidates(input: {
  strings: ParsedString[];
  cache: CacheFile;
  force?: boolean;
}): ReviewCandidate[] {
  return input.strings
    .filter((item) => shouldReview(item))
    .map((item) => ({
      ...item,
      hash: buildStringHash(item),
    }))
    .filter((item) => {
      if (input.force) {
        return true;
      }

      if (input.cache.rulesVersion !== undefined && input.cache.rulesVersion !== "v1") {
        return true;
      }

      return !(item.hash in input.cache.items);
    })
    .sort((a, b) => a.key.localeCompare(b.key, "en"));
}

export function buildBatches(candidates: ReviewCandidate[], batchSize: number): ReviewBatch[] {
  const batches: ReviewBatch[] = [];

  for (let index = 0; index < candidates.length; index += batchSize) {
    const slice = candidates.slice(index, index + batchSize);
    const mappings: Record<string, ReviewCandidate> = {};
    const strings = slice.map((item, itemIndex) => {
      const shortKey = String(itemIndex + 1);
      mappings[shortKey] = item;
      return {
        key: shortKey,
        o: item.original,
        t: item.translation,
      };
    });

    batches.push({ mappings, strings });
  }

  return batches;
}

export function limitCandidates(
  candidates: ReviewCandidate[],
  maxStrings?: number,
): ReviewCandidate[] {
  if (!maxStrings || maxStrings <= 0) {
    return candidates;
  }

  return candidates.slice(0, maxStrings);
}

function shouldReview(item: ParsedString): boolean {
  const prefilter = APP_CONFIG.review.prefilter;
  const original = item.original.trim();
  const translation = item.translation.trim();

  if (!translation) {
    return false;
  }

  if (
    original.length < prefilter.minOriginalLength ||
    translation.length < prefilter.minTranslationLength
  ) {
    return false;
  }

  if (prefilter.requireWordChar && !containsWordChar(original) && !containsWordChar(translation)) {
    return false;
  }

  if (
    prefilter.skipPunctuationOnly &&
    (isPunctuationOnly(original) || isPunctuationOnly(translation))
  ) {
    return false;
  }

  return true;
}

function containsWordChar(value: string): boolean {
  return /[\p{L}\p{N}_]/u.test(value);
}

function isPunctuationOnly(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !/[\p{L}\p{N}_]/u.test(trimmed);
}
