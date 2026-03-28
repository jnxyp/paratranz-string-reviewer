import { mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function ensureParentDir(path: string): void {
  ensureDir(dirname(path));
}

export function resetDir(path: string): void {
  rmSync(path, { recursive: true, force: true });
  ensureDir(path);
}

export function listFilesRecursively(root: string): string[] {
  const entries = readdirSync(root);
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(root, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...listFilesRecursively(fullPath));
      continue;
    }

    files.push(fullPath);
  }

  return files;
}
