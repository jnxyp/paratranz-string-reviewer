import { APP_CONFIG, type Category, type RuleId } from "./config.js";
export type { Category, RuleId } from "./config.js";

export interface ReviewRule {
  id: RuleId;
  criteria: string;
  report: string;
  category: Category;
}

export const RULES_VERSION = APP_CONFIG.review.rulesVersion;

export const REVIEW_RULES: readonly ReviewRule[] = APP_CONFIG.rules;

export const RULES_BY_ID = Object.fromEntries(
  REVIEW_RULES.map((rule) => [rule.id, rule]),
) as Record<RuleId, ReviewRule>;
