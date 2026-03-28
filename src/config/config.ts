type ReviewRuleConfig = {
  id: string;
  criteria: string;
  report: string;
  category: string;
};

type AppConfigShape = {
  openai: {
    model: string;
  };
  review: {
    rulesVersion: string;
    batchSize: number;
    concurrency: number;
    exportRetries: number;
    exportWaitMs: number;
    prefilter: {
      minOriginalLength: number;
      minTranslationLength: number;
      requireWordChar: boolean;
      skipPunctuationOnly: boolean;
    };
  };
  prompts: {
    system: string;
    userTemplate: string;
  };
  rules: readonly ReviewRuleConfig[];
};

export const APP_CONFIG = {
  openai: {
    model: "gpt-5.4-mini",
  },
  review: {
    rulesVersion: "v1",
    batchSize: 50,
    concurrency: 1,
    exportRetries: 5,
    exportWaitMs: 3000,
    prefilter: {
      minOriginalLength: 10,
      minTranslationLength: 10,
      requireWordChar: true,
      skipPunctuationOnly: true,
    },
  },
  prompts: {
    system: `你是一个中文翻译审核助手。

输入包含：
- 审核规则
- 术语表
- 一批翻译词条

你的任务是找出有问题的词条，并按规则 ID 返回命中结果。

输出要求：
- 只输出有问题的词条
- 输出合法 JSON
- 输出字段尽量短`,
    userTemplate: `请审核下面这批翻译词条。

【任务】
- 只输出有问题的词条
- 输入中的 key 是短编号，仅用于定位
- 词条已经按 key 排序
- 按规则 ID 返回命中结果

【规则】
{{RULES_JSON}}

【术语表】
{{TERMS_JSON}}

- 术语是否适用需要结合 note 判断
- 只有 note 和当前词条都支持时，才按术语表判定

【输出格式】
- 输出必须是 JSON 对象
- 顶层字段固定为 issues
- 如果没有问题，返回 {"issues":[]}
- 每个 issue 只包含 key 和 hits
- hits 是对象数组
- 每个 hit 包含 rid
- 每个 hit 可选包含 reason
- reason 尽量简短

【词条】
{{STRINGS_JSON}}`,
  },
  rules: [
    {
      id: "R1",
      criteria: "译文有明显输入错误，如错别字、漏字、多字或误输入字符",
      report: "命中时只报告明确的输入错误，reason 简短指出错误点即可",
      category: "typo",
    },
    {
      id: "R2",
      criteria: "译文存在明显叠字或重复片段",
      report: "命中时只报告重复片段本身，reason 可直接写重复内容或重复类型",
      category: "duplicate_text",
    },
    {
      id: "R3",
      criteria: "译文明显不符合术语表",
      report: "命中时优先在 reason 中指出对应术语或术语不符点",
      category: "term_mismatch",
    },
    {
      id: "R4",
      criteria: "整句话未翻译，或译文中出现与原文毫无关系的内容；对原文的合理补充不包含在内",
      report: "命中时明确说明是整句漏译，还是出现了与原文毫无关系的内容",
      category: "source_target_mismatch",
    },
    // {
    //   id: "R5",
    //   criteria: "存在导致意思完全错误的非常严重问题，不包括其他小问题",
    //   report: "命中时仅报告会导致整体意思完全错误的严重问题，reason 说明错误核心",
    //   category: "other",
    // },
  ],
} as const satisfies AppConfigShape;

export type AppConfig = typeof APP_CONFIG;
export type ReviewRule = (typeof APP_CONFIG.rules)[number];
export type RuleId = ReviewRule["id"];
export type Category = ReviewRule["category"];
