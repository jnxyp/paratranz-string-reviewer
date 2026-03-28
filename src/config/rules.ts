import { APP_CONFIG, type Category, type RuleId, type Severity } from "./app-config.js";
export type { Category, RuleId, Severity } from "./app-config.js";

export interface ReviewRule {
  id: RuleId;
  desc: string;
  severity: Severity;
  category: Category;
}

export const RULES_VERSION = APP_CONFIG.review.rulesVersion;

export const REVIEW_RULES: ReviewRule[] = APP_CONFIG.rules;

export const RULES_BY_ID = Object.fromEntries(
  REVIEW_RULES.map((rule) => [rule.id, rule]),
) as Record<RuleId, ReviewRule>;
