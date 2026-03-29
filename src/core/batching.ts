import { buildStringHash } from "./cache.js";
import { getAppConfig } from "../config/config.js";
import type { ParsedString } from "./parse.js";

export interface ReviewCandidate extends ParsedString {
  normalizedOriginal: string;
  normalizedTranslation: string;
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
  skippedNoChineseInTranslation: number;
  skippedPunctuationOnly: number;
  candidateCount: number;
}

export function buildReviewCandidates(input: {
  strings: ParsedString[];
}): ReviewCandidate[] {
  return input.strings
    .filter((item) => shouldReview(item))
    .map((item) => {
      const normalizedOriginal = normalizeForReview(item.original);
      const normalizedTranslation = normalizeForReview(item.translation);

      return {
        ...item,
        normalizedOriginal,
        normalizedTranslation,
        hash: buildStringHash({
          key: item.key,
          original: normalizedOriginal,
          translation: normalizedTranslation,
        }),
      };
    })
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
    skippedNoChineseInTranslation: 0,
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
      case "no_chinese_in_translation":
        stats.skippedNoChineseInTranslation += 1;
        break;
      case "punctuation_only":
        stats.skippedPunctuationOnly += 1;
        break;
    }
  }

  return stats;
}

export function buildBatches(
  candidates: ReviewCandidate[],
  batchSize: number,
  batchMaxChars: number,
): ReviewBatch[] {
  const batches: ReviewBatch[] = [];

  let currentBatch: ReviewCandidate[] = [];
  let currentChars = 0;

  for (const candidate of candidates) {
    const candidateChars =
      candidate.normalizedOriginal.length + candidate.normalizedTranslation.length;
    const wouldExceedSize = currentBatch.length >= batchSize;
    const wouldExceedChars =
      currentBatch.length > 0 && currentChars + candidateChars > batchMaxChars;

    if (wouldExceedSize || wouldExceedChars) {
      batches.push(buildBatch(currentBatch));
      currentBatch = [];
      currentChars = 0;
    }

    currentBatch.push(candidate);
    currentChars += candidateChars;
  }

  if (currentBatch.length > 0) {
    batches.push(buildBatch(currentBatch));
  }

  return batches;
}

function buildBatch(candidates: ReviewCandidate[]): ReviewBatch {
  const mappings: Record<string, ReviewCandidate> = {};
  const strings = candidates.map((item, itemIndex) => {
    const shortKey = String(itemIndex + 1);
    mappings[shortKey] = item;
    return {
      key: shortKey,
      o: item.normalizedOriginal,
      t: item.normalizedTranslation,
    };
  });

  return { mappings, strings };
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
  | "no_chinese_in_translation"
  | "punctuation_only"
  | null {
  const { review } = getAppConfig();
  const prefilter = review.prefilter;
  const original = normalizeForReview(item.original).trim();
  const translation = normalizeForReview(item.translation).trim();

  if (item.stage === null || !review.allowedStages.includes(item.stage)) {
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

  if (prefilter.requireChineseInTranslation && !containsChineseChar(translation)) {
    return "no_chinese_in_translation";
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

function containsChineseChar(value: string): boolean {
  return /\p{Script=Han}/u.test(value);
}

function stripCurlyBraces(value: string): string {
  return value.replace(/[{}｛｝]/g, "");
}

function normalizeForReview(value: string): string {
  const { prefilter } = getAppConfig().review;
  if (!prefilter.stripCurlyBraces) {
    return value;
  }

  return stripCurlyBraces(value);
}
