export const APP_CONFIG = {
  openai: {
    model: "gpt-5.4-mini",
  },
  review: {
    rulesVersion: "v1",
    batchSize: 50,
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
      desc: "整句话未翻译，或译文出现整句原文中不存在的内容",
      severity: "error",
      category: "source_target_mismatch",
    },
    {
      id: "R5",
      desc: "存在其他严重问题",
      severity: "error",
      category: "other",
    },
  ],
} as const;

export type AppConfig = typeof APP_CONFIG;
export type ReviewRule = (typeof APP_CONFIG.rules)[number];
export type RuleId = ReviewRule["id"];
export type Severity = ReviewRule["severity"];
export type Category = ReviewRule["category"];
