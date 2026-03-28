import { rmSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type { RuleId } from "../config/rules.js";
import { getRulesVersion } from "../config/rules.js";
import { sha256 } from "../utils/hash.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";

const cacheHitSchema = z.object({
  rid: z.string() as z.ZodType<RuleId>,
  reason: z.string().optional(),
});

const cachedIssueSchema = z.object({
  filePath: z.string(),
  key: z.string(),
  original: z.string(),
  translation: z.string(),
  hits: z.array(cacheHitSchema),
});

const cacheEntrySchema = z.object({
  key: z.string(),
  reviewedAt: z.string(),
  issue: cachedIssueSchema.nullable(),
});

const cacheFileSchema = z.object({
  rulesVersion: z.string(),
  items: z.record(z.string(), cacheEntrySchema),
});

export type CacheFile = z.infer<typeof cacheFileSchema>;

export function getCachePath(dataDir: string, projectId: number): string {
  return join(dataDir, "cache", `project-${projectId}.json`);
}

export function loadCache(path: string): CacheFile {
  try {
    const cache = cacheFileSchema.parse(readJsonFile(path));
    if (cache.rulesVersion !== getRulesVersion()) {
      rmSync(path, { force: true });
      return createEmptyCache();
    }
    return cache;
  } catch {
    rmSync(path, { force: true });
    return createEmptyCache();
  }
}

export function saveCache(path: string, cache: CacheFile): void {
  writeJsonFile(path, cache);
}

export function buildStringHash(input: {
  key: string;
  original: string;
  translation: string;
}): string {
  return sha256(`${input.key}\n${input.original}\n${input.translation}`);
}

function createEmptyCache(): CacheFile {
  return {
    rulesVersion: getRulesVersion(),
    items: {},
  };
}
