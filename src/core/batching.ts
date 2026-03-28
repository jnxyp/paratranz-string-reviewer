import { buildStringHash } from "./cache.js";
import { getAppConfig } from "../config/config.js";
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

export interface ReviewCandidateStats {
  totalStrings: number;
  skippedStageNotTranslated: number;
  skippedEmptyTranslation: number;
  skippedShortOriginal: number;
  skippedShortTranslation: number;
  skippedNoWordChars: number;
  skippedPunctuationOnly: number;
  candidateCount: number;
}

export function buildReviewCandidates(input: {
  strings: ParsedString[];
}): ReviewCandidate[] {
  return input.strings
    .filter((item) => shouldReview(item))
    .map((item) => ({
      ...item,
      hash: buildStringHash(item),
    }))
    .sort((a, b) => a.key.localeCompare(b.key, "en"));
}

export function analyzeReviewCandidates(strings: ParsedString[]): ReviewCandidateStats {
  const stats: ReviewCandidateStats = {
    totalStrings: 0,
    skippedStageNotTranslated: 0,
    skippedEmptyTranslation: 0,
    skippedShortOriginal: 0,
    skippedShortTranslation: 0,
    skippedNoWordChars: 0,
    skippedPunctuationOnly: 0,
    candidateCount: 0,
  };

  for (const item of strings) {
    stats.totalStrings += 1;
    const skipReason = getSkipReason(item);
    if (!skipReason) {
      stats.candidateCount += 1;
      continue;
    }

    switch (skipReason) {
      case "stage_not_translated":
        stats.skippedStageNotTranslated += 1;
        break;
      case "empty_translation":
        stats.skippedEmptyTranslation += 1;
        break;
      case "short_original":
        stats.skippedShortOriginal += 1;
        break;
      case "short_translation":
        stats.skippedShortTranslation += 1;
        break;
      case "no_word_chars":
        stats.skippedNoWordChars += 1;
        break;
      case "punctuation_only":
        stats.skippedPunctuationOnly += 1;
        break;
    }
  }

  return stats;
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
  return getSkipReason(item) === null;
}

function getSkipReason(item: ParsedString):
  | "stage_not_translated"
  | "empty_translation"
  | "short_original"
  | "short_translation"
  | "no_word_chars"
  | "punctuation_only"
  | null {
  const prefilter = getAppConfig().review.prefilter;
  const original = item.original.trim();
  const translation = item.translation.trim();

  if (item.stage !== 1) {
    return "stage_not_translated";
  }

  if (!translation) {
    return "empty_translation";
  }

  if (original.length < prefilter.minOriginalLength) {
    return "short_original";
  }

  if (translation.length < prefilter.minTranslationLength) {
    return "short_translation";
  }

  if (prefilter.requireWordChar && !containsWordChar(original) && !containsWordChar(translation)) {
    return "no_word_chars";
  }

  if (
    prefilter.skipPunctuationOnly &&
    (isPunctuationOnly(original) || isPunctuationOnly(translation))
  ) {
    return "punctuation_only";
  }

  return null;
}

function containsWordChar(value: string): boolean {
  return /[\p{L}\p{N}_]/u.test(value);
}

function isPunctuationOnly(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && !/[\p{L}\p{N}_]/u.test(trimmed);
}
