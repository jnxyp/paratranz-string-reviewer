import { readFileSync, writeFileSync } from "node:fs";
import { ensureParentDir } from "./fs.js";

export function readJsonFile<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function writeJsonFile(path: string, value: unknown): void {
  ensureParentDir(path);
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}
