import { join } from "node:path";
import { z } from "zod";
import { RULES_VERSION } from "../config/rules.js";
import { sha256 } from "../utils/hash.js";
import { readJsonFile, writeJsonFile } from "../utils/json.js";

const cacheEntrySchema = z.object({
  key: z.string(),
  reviewedAt: z.string(),
  status: z.enum(["clean", "has_issue"]),
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
    return cacheFileSchema.parse(readJsonFile(path));
  } catch {
    return {
      rulesVersion: RULES_VERSION,
      items: {},
    };
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
