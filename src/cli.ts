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
} from "./core/batching.js";
import { getCachePath, loadCache, saveCache } from "./core/cache.js";
import { downloadAndExtractArtifact } from "./core/export.js";
import { parseExtractedStrings } from "./core/parse.js";
import { buildProjectResult, saveProjectResult } from "./core/result.js";
import { reviewBatches } from "./core/review.js";
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
      cache,
      force: options.force,
    });
    const limitedCandidates = limitCandidates(candidates, maxStrings);

    if (limitedCandidates.length === 0) {
      console.log("No pending strings after prefilter and cache checks.");
      console.log(`Terms saved to ${termsPath}`);
      return;
    }

    const batches = buildBatches(limitedCandidates, batchSize);
    console.log(
      `Reviewing ${limitedCandidates.length} strings in ${batches.length} batches...`,
    );
    const reviewedIssues = await reviewBatches({
      client: openai,
      batches,
      terms,
    });

    const result = buildProjectResult({
      projectId,
      artifactPath: artifact.artifactPath,
      issues: reviewedIssues,
    });
    const resultPath = saveProjectResult({
      dataDir,
      projectId,
      result,
    });

    const now = new Date().toISOString();
    for (const candidate of limitedCandidates) {
      const hasIssue = reviewedIssues.some((issue) => issue.key === candidate.key);
      cache.items[candidate.hash] = {
        key: candidate.key,
        reviewedAt: now,
        status: hasIssue ? "has_issue" : "clean",
      };
    }
    cache.rulesVersion = RULES_VERSION;
    saveCache(cachePath, cache);

    console.log(`Artifact: ${artifact.artifactPath}`);
    console.log(`Terms: ${termsPath}`);
    console.log(`Result: ${resultPath}`);
    console.log(`Issues found: ${reviewedIssues.length}`);
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
