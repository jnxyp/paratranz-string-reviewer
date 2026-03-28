#!/usr/bin/env node
import { Command } from "commander";
import { join } from "node:path";
import { OpenAIReviewClient } from "./clients/openai.js";
import { ParatranzClient } from "./clients/paratranz.js";
import { APP_CONFIG } from "./config/config.js";
import { loadEnv } from "./config/env.js";
import { RULES_VERSION } from "./config/rules.js";
import {
  buildBatches,
  buildReviewCandidates,
  limitCandidates,
  splitCandidatesByCache,
} from "./core/batching.js";
import { getCachePath, loadCache, saveCache, type CacheFile } from "./core/cache.js";
import { downloadAndExtractArtifact } from "./core/export.js";
import { parseExtractedStrings } from "./core/parse.js";
import { buildProjectResult, saveProjectResult } from "./core/result.js";
import {
  reviewBatches,
  type ReviewedIssue,
  type ReviewRunResult,
} from "./core/review.js";
import { fetchAndSaveTerms } from "./core/terms.js";
import { ensureDir } from "./utils/fs.js";

const program = new Command();
const env = loadEnv();
const dataDir = join(process.cwd(), "data");

ensureDir(dataDir);

program
  .name("reviewer")
  .description("Review Paratranz strings with an LLM")
  .version("0.1.0");

program
  .command("run")
  .requiredOption("--project <id>", "Paratranz project id")
  .option("--batch-size <number>", "Batch size")
  .option("--max-strings <number>", "Only review the first N candidate strings")
  .option("--force", "Ignore review cache")
  .action(async (options) => {
    const projectId = Number.parseInt(options.project, 10);
    const batchSize = options.batchSize
      ? Number.parseInt(options.batchSize, 10)
      : APP_CONFIG.review.batchSize;
    const maxStrings = options.maxStrings
      ? Number.parseInt(options.maxStrings, 10)
      : undefined;

    if (!env.OPENAI_API_KEY) {
      throw new Error("OPENAI_API_KEY is required for reviewer run.");
    }

    const paratranz = new ParatranzClient({ apiKey: env.PARATRANZ_API_KEY });
    const openai = new OpenAIReviewClient({
      apiKey: env.OPENAI_API_KEY,
      model: APP_CONFIG.openai.model,
    });

    console.log(`Project: ${projectId}`);
    console.log("Downloading latest artifact...");
    const artifact = await downloadAndExtractArtifact({
      client: paratranz,
      projectId,
      dataDir,
      retries: APP_CONFIG.review.exportRetries,
      waitMs: APP_CONFIG.review.exportWaitMs,
    });

    console.log("Fetching terms...");
    const { terms, path: termsPath } = await fetchAndSaveTerms({
      client: paratranz,
      projectId,
      dataDir,
    });

    console.log("Parsing extracted strings...");
    const parsedStrings = parseExtractedStrings(artifact.extractedDir);
    if (parsedStrings.length === 0) {
      throw new Error("No reviewable strings were parsed from the artifact.");
    }

    const cachePath = getCachePath(dataDir, projectId);
    const cache = loadCache(cachePath);
    const candidates = buildReviewCandidates({
      strings: parsedStrings,
    });
    const limitedCandidates = limitCandidates(candidates, maxStrings);
    const { cachedCandidates, pendingCandidates } = splitCandidatesByCache({
      candidates: limitedCandidates,
      cache,
      force: options.force,
    });
    const cachedIssues = getCachedIssues({
      cache,
      candidates: cachedCandidates,
    });

    if (limitedCandidates.length === 0) {
      console.log("No reviewable strings after prefilter.");
      console.log(`Terms saved to ${termsPath}`);
      return;
    }

    let reviewRun: ReviewRunResult = {
      issues: [] as ReviewedIssue[],
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
      },
      model: APP_CONFIG.openai.model,
    };

    if (pendingCandidates.length > 0) {
      const batches = buildBatches(pendingCandidates, batchSize);
      console.log(
        `Reviewing ${pendingCandidates.length} new strings in ${batches.length} batches...`,
      );
      reviewRun = await reviewBatches({
        client: openai,
        batches,
        terms,
        concurrency: APP_CONFIG.review.concurrency,
      });
    } else {
      console.log("No new strings to review. Using cached results only.");
    }

    const allIssues = [...cachedIssues, ...reviewRun.issues].sort((a, b) =>
      a.key.localeCompare(b.key, "en"),
    );

    const result = buildProjectResult({
      projectId,
      model: reviewRun.model,
      totalStringCount: limitedCandidates.length,
      cachedStringCount: cachedCandidates.length,
      reviewedStringCount: pendingCandidates.length,
      usage: reviewRun.usage,
      issues: allIssues,
    });
    const resultPath = saveProjectResult({
      dataDir,
      projectId,
      result,
    });

    const now = new Date().toISOString();
    const issuesByKey = new Map(reviewRun.issues.map((issue) => [issue.key, issue]));
    for (const candidate of pendingCandidates) {
      const issue = issuesByKey.get(candidate.key) ?? null;
      cache.items[candidate.hash] = {
        key: candidate.key,
        reviewedAt: now,
        issue,
      };
    }
    cache.rulesVersion = RULES_VERSION;
    saveCache(cachePath, cache);

    console.log(`Artifact: ${artifact.artifactPath}`);
    console.log(`Terms: ${termsPath}`);
    console.log(`Result: ${resultPath}`);
    console.log(`Model: ${reviewRun.model}`);
    console.log(`Input tokens: ${reviewRun.usage.inputTokens}`);
    console.log(`Output tokens: ${reviewRun.usage.outputTokens}`);
    console.log(`Total tokens: ${reviewRun.usage.totalTokens}`);
    console.log(`Total strings: ${result.stats.totalStringCount}`);
    console.log(`Cached strings: ${result.stats.cachedStringCount}`);
    console.log(`Reviewed strings: ${result.stats.reviewedStringCount}`);
    console.log(`Issue strings: ${result.stats.issueStringCount}`);
    console.log(`Issue count: ${result.stats.issueCount}`);
    console.log(`Cached issue count: ${result.stats.cachedIssueCount}`);
    console.log(`New issue count: ${result.stats.newIssueCount}`);
  });

program
  .command("export")
  .requiredOption("--project <id>", "Paratranz project id")
  .action(async (options) => {
    const projectId = Number.parseInt(options.project, 10);
    const paratranz = new ParatranzClient({ apiKey: env.PARATRANZ_API_KEY });
    const artifact = await downloadAndExtractArtifact({
      client: paratranz,
      projectId,
      dataDir,
      retries: APP_CONFIG.review.exportRetries,
      waitMs: APP_CONFIG.review.exportWaitMs,
    });
    console.log(`Artifact: ${artifact.artifactPath}`);
    console.log(`Extracted: ${artifact.extractedDir}`);
  });

program
  .command("terms")
  .requiredOption("--project <id>", "Paratranz project id")
  .action(async (options) => {
    const projectId = Number.parseInt(options.project, 10);
    const paratranz = new ParatranzClient({ apiKey: env.PARATRANZ_API_KEY });
    const result = await fetchAndSaveTerms({
      client: paratranz,
      projectId,
      dataDir,
    });
    console.log(`Terms saved: ${result.path}`);
    console.log(`Term count: ${result.terms.length}`);
  });

program.parseAsync(process.argv).catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});

function getCachedIssues(input: {
  cache: CacheFile;
  candidates: Array<{ hash: string }>;
}): ReviewedIssue[] {
  const issues: ReviewedIssue[] = [];

  for (const candidate of input.candidates) {
    const entry = input.cache.items[candidate.hash];
    if (!entry?.issue) {
      continue;
    }
    issues.push({
      ...entry.issue,
      fromCache: true,
    });
  }

  return issues;
}
