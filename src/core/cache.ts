import Database from "better-sqlite3";
import { join } from "node:path";
import type { RuleId } from "../config/rules.js";
import { getRulesVersion } from "../config/rules.js";
import { sha256 } from "../utils/hash.js";
import type { ReviewCandidate } from "./batching.js";
import type { ReviewedIssue } from "./review.js";

interface CacheIssueRecord {
  filePath: string;
  key: string;
  original: string;
  translation: string;
  hits: Array<{
    rid: RuleId;
    reason?: string;
  }>;
}

interface CacheRow {
  hash: string;
  key: string;
  reviewed_at: string;
  issue_json: string | null;
}

export function getCachePath(dataDir: string, projectId: number): string {
  return join(dataDir, "cache", `project-${projectId}.sqlite`);
}

export function buildStringHash(input: {
  key: string;
  original: string;
  translation: string;
}): string {
  return sha256(`${input.key}\n${input.original}\n${input.translation}`);
}

export class CacheStore {
  private readonly db: Database.Database;
  private readonly getMetaStmt;
  private readonly setMetaStmt;
  private readonly clearEntriesStmt;
  private readonly getEntryStmt;
  private readonly upsertEntryStmt;
  private readonly upsertManyTxn;

  constructor(path: string) {
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("busy_timeout = 5000");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS cache_meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS reviewed_strings (
        hash TEXT PRIMARY KEY,
        key TEXT NOT NULL,
        reviewed_at TEXT NOT NULL,
        issue_json TEXT
      );
    `);

    this.getMetaStmt = this.db.prepare(
      "SELECT value FROM cache_meta WHERE key = ?",
    );
    this.setMetaStmt = this.db.prepare(`
      INSERT INTO cache_meta (key, value)
      VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `);
    this.clearEntriesStmt = this.db.prepare("DELETE FROM reviewed_strings");
    this.getEntryStmt = this.db.prepare< [string], CacheRow >(
      "SELECT hash, key, reviewed_at, issue_json FROM reviewed_strings WHERE hash = ?",
    );
    this.upsertEntryStmt = this.db.prepare(`
      INSERT INTO reviewed_strings (hash, key, reviewed_at, issue_json)
      VALUES (@hash, @key, @reviewed_at, @issue_json)
      ON CONFLICT(hash) DO UPDATE SET
        key = excluded.key,
        reviewed_at = excluded.reviewed_at,
        issue_json = excluded.issue_json
    `);
    this.upsertManyTxn = this.db.transaction(
      (
        rows: Array<{
          hash: string;
          key: string;
          reviewed_at: string;
          issue_json: string | null;
        }>,
      ) => {
        for (const row of rows) {
          this.upsertEntryStmt.run(row);
        }
      },
    );

    this.initializeRulesVersion();
  }

  close(): void {
    this.db.close();
  }

  splitCandidates(candidates: ReviewCandidate[], force = false): {
    cachedCandidates: ReviewCandidate[];
    pendingCandidates: ReviewCandidate[];
  } {
    if (force) {
      return {
        cachedCandidates: [],
        pendingCandidates: candidates,
      };
    }

    const cachedCandidates: ReviewCandidate[] = [];
    const pendingCandidates: ReviewCandidate[] = [];

    for (const candidate of candidates) {
      if (this.has(candidate.hash)) {
        cachedCandidates.push(candidate);
      } else {
        pendingCandidates.push(candidate);
      }
    }

    return {
      cachedCandidates,
      pendingCandidates,
    };
  }

  getCachedIssues(candidates: ReviewCandidate[]): ReviewedIssue[] {
    const issues: ReviewedIssue[] = [];

    for (const candidate of candidates) {
      const row = this.getEntryStmt.get(candidate.hash);
      if (!row?.issue_json) {
        continue;
      }

      const issue = JSON.parse(row.issue_json) as CacheIssueRecord;
      issues.push({
        ...issue,
        fromCache: true,
      });
    }

    return issues;
  }

  upsertReviewedBatch(input: {
    candidates: ReviewCandidate[];
    issues: ReviewedIssue[];
    reviewedAt: string;
  }): void {
    const issuesByKey = new Map(input.issues.map((issue) => [issue.key, issue]));
    const rows = input.candidates.map((candidate) => {
      const issue = issuesByKey.get(candidate.key) ?? null;
      return {
        hash: candidate.hash,
        key: candidate.key,
        reviewed_at: input.reviewedAt,
        issue_json: issue
          ? JSON.stringify({
              filePath: issue.filePath,
              key: issue.key,
              original: issue.original,
              translation: issue.translation,
              hits: issue.hits,
            } satisfies CacheIssueRecord)
          : null,
      };
    });

    this.upsertManyTxn(rows);
  }

  private has(hash: string): boolean {
    return this.getEntryStmt.get(hash) !== undefined;
  }

  private initializeRulesVersion(): void {
    const currentRulesVersion = getRulesVersion();
    const existing = this.getMetaStmt.get("rules_version") as { value: string } | undefined;

    if (!existing) {
      this.setMetaStmt.run("rules_version", currentRulesVersion);
      return;
    }

    if (existing.value !== currentRulesVersion) {
      this.clearEntriesStmt.run();
      this.setMetaStmt.run("rules_version", currentRulesVersion);
    }
  }
}
