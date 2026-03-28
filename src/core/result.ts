import { join } from "node:path";
import { RULES_BY_ID, RULES_VERSION, type Category, type Severity } from "../config/rules.js";
import type { ReviewedIssue } from "./review.js";
import { writeJsonFile } from "../utils/json.js";

export interface ProjectIssueResult {
  filePath: string;
  key: string;
  original: string;
  translation: string;
  severity: Severity;
  category: Category;
  hits: ReviewedIssue["hits"];
}

export interface ProjectResult {
  projectId: number;
  generatedAt: string;
  rulesVersion: string;
  sourceArtifact: string;
  issues: ProjectIssueResult[];
}

export function buildProjectResult(input: {
  projectId: number;
  artifactPath: string;
  issues: ReviewedIssue[];
}): ProjectResult {
  return {
    projectId: input.projectId,
    generatedAt: new Date().toISOString(),
    rulesVersion: RULES_VERSION,
    sourceArtifact: input.artifactPath,
    issues: input.issues.map((issue) => {
      const firstRule = RULES_BY_ID[issue.hits[0]!.rid];
      return {
        filePath: issue.filePath,
        key: issue.key,
        original: issue.original,
        translation: issue.translation,
        severity: firstRule.severity,
        category: firstRule.category,
        hits: issue.hits,
      };
    }),
  };
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
