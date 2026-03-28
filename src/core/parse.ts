import { relative } from "node:path";
import { listFilesRecursively } from "../utils/fs.js";
import { readJsonFile } from "../utils/json.js";

export interface ParsedString {
  filePath: string;
  key: string;
  original: string;
  translation: string;
  stage: number | null;
}

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

export function parseExtractedStrings(extractedDir: string): ParsedString[] {
  const files = listFilesRecursively(extractedDir).filter((path) => path.endsWith(".json"));
  const results: ParsedString[] = [];

  for (const file of files) {
    const filePath = relative(extractedDir, file);
    const content = readJsonFile<JsonValue>(file);
    results.push(...extractStrings(content, filePath));
  }

  return results;
}

function extractStrings(node: JsonValue, filePath: string): ParsedString[] {
  const results: ParsedString[] = [];

  function visit(value: JsonValue): void {
    if (Array.isArray(value)) {
      for (const item of value) {
        visit(item);
      }
      return;
    }

    if (!value || typeof value !== "object") {
      return;
    }

    const candidate = value as Record<string, JsonValue>;
    const key = typeof candidate.key === "string" ? candidate.key : null;
    const original = typeof candidate.original === "string" ? candidate.original : null;
    const translation =
      typeof candidate.translation === "string" ? candidate.translation : null;
    const stage = typeof candidate.stage === "number" ? candidate.stage : null;

    if (key && original !== null && translation !== null) {
      results.push({ filePath, key, original, translation, stage });
      return;
    }

    for (const child of Object.values(candidate)) {
      visit(child);
    }
  }

  visit(node);
  return results;
}
