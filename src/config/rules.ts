export type RuleId = "R1" | "R2" | "R3" | "R4" | "R5";
export type Severity = "error";
export type Category =
  | "typo"
  | "duplicate_text"
  | "term_mismatch"
  | "source_target_mismatch"
  | "other";

export interface ReviewRule {
  id: RuleId;
  desc: string;
  severity: Severity;
  category: Category;
}

export const RULES_VERSION = "v1";

export const REVIEW_RULES: ReviewRule[] = [
  {
    id: "R1",
    desc: "译文有明显输入错误，如错别字、漏字、多字或误输入字符",
    severity: "error",
    category: "typo",
  },
  {
    id: "R2",
    desc: "译文存在明显叠字或重复片段",
    severity: "error",
    category: "duplicate_text",
  },
  {
    id: "R3",
    desc: "译文明显不符合术语表",
    severity: "error",
    category: "term_mismatch",
  },
  {
    id: "R4",
    desc: "原文与译文明显不对应",
    severity: "error",
    category: "source_target_mismatch",
  },
  {
    id: "R5",
    desc: "存在其他严重问题",
    severity: "error",
    category: "other",
  },
];

export const RULES_BY_ID = Object.fromEntries(
  REVIEW_RULES.map((rule) => [rule.id, rule]),
) as Record<RuleId, ReviewRule>;
