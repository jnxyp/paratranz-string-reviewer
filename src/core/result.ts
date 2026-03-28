import { join } from "node:path";
import {
  REVIEW_RULES,
  RULES_BY_ID,
  RULES_VERSION,
  type Category,
  type ReviewRule,
} from "../config/rules.js";
import type { ReviewedIssue } from "./review.js";
import { writeJsonFile } from "../utils/json.js";

export interface ResultHit {
  rid: ReviewedIssue["hits"][number]["rid"];
  reason?: string;
  rule: ReviewRule;
}

export interface ProjectIssueResult {
  filePath: string;
  key: string;
  stringUrl: string;
  original: string;
  translation: string;
  fromCache: boolean;
  category: Category;
  hits: ResultHit[];
}

export interface ProjectResult {
  projectId: number;
  generatedAt: string;
  model: string;
  rulesVersion: string;
  stats: {
    totalStringCount: number;
    cachedStringCount: number;
    reviewedStringCount: number;
    issueStringCount: number;
    issueCount: number;
    cachedIssueCount: number;
    newIssueCount: number;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  rules: ReviewRule[];
  issues: ProjectIssueResult[];
}

export function buildProjectResult(input: {
  projectId: number;
  model: string;
  totalStringCount: number;
  cachedStringCount: number;
  reviewedStringCount: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  issues: ReviewedIssue[];
}): ProjectResult {
  return {
    projectId: input.projectId,
    generatedAt: new Date().toISOString(),
    model: input.model,
    rulesVersion: RULES_VERSION,
    stats: {
      totalStringCount: input.totalStringCount,
      cachedStringCount: input.cachedStringCount,
      reviewedStringCount: input.reviewedStringCount,
      issueStringCount: input.issues.length,
      issueCount: input.issues.reduce((sum, issue) => sum + issue.hits.length, 0),
      cachedIssueCount: input.issues
        .filter((issue) => issue.fromCache)
        .reduce((sum, issue) => sum + issue.hits.length, 0),
      newIssueCount: input.issues
        .filter((issue) => !issue.fromCache)
        .reduce((sum, issue) => sum + issue.hits.length, 0),
    },
    usage: input.usage,
    rules: [...REVIEW_RULES],
    issues: input.issues.map((issue) => {
      const firstRule = RULES_BY_ID[issue.hits[0]!.rid];
      return {
        filePath: issue.filePath,
        key: issue.key,
        stringUrl: buildStringUrl(input.projectId, issue.key),
        original: issue.original,
        translation: issue.translation,
        fromCache: issue.fromCache,
        category: firstRule.category,
        hits: issue.hits.map((hit) => ({
          rid: hit.rid,
          reason: hit.reason,
          rule: RULES_BY_ID[hit.rid],
        })),
      };
    }),
  };
}

function buildStringUrl(projectId: number, key: string): string {
  return `https://paratranz.cn/projects/${projectId}/strings?key=${encodeURIComponent(key)}`;
}

export function saveProjectResult(input: {
  dataDir: string;
  projectId: number;
  result: ProjectResult;
}): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(input.dataDir, "results", `project-${input.projectId}-${stamp}.json`);
  writeJsonFile(path, input.result);
  return path;
}
