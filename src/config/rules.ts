import { getAppConfig, type ReviewRule, type RuleId } from "./config.js";

export type { ReviewRule, RuleId } from "./config.js";

export function getRulesVersion(): string {
  return getAppConfig().review.rulesVersion;
}

export function getReviewRules(): ReviewRule[] {
  return [...getAppConfig().rules];
}

export function getRulesById(): Record<string, ReviewRule> {
  return Object.fromEntries(getReviewRules().map((rule) => [rule.id, rule]));
}
