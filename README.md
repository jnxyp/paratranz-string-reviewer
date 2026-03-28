# Paratranz String Reviewer

一个用于审阅 Paratranz 项目翻译词条的小工具。

项目目标：

- 从 Paratranz 拉取项目最新导出包
- 拉取术语表
- 将词条分批交给 LLM 审阅
- 输出结构化问题文件，供后续处理

当前实现是一个本地 CLI，主流程会：

- 触发 artifact 导出并下载最新项目文件
- 拉取术语表
- 过滤可审核词条
- 分批调用 OpenAI 审核
- 输出结果到 `data/results/*.json`

## 使用

CLI 默认读取当前目录下的 [config.json](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/config.json)。

先在 [`.env.example`](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/.env.example) 的基础上准备 [`.env`](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/.env)，至少包含：

```env
PARATRANZ_API_KEY=...
OPENAI_API_KEY=...
```

安装依赖：

```bash
pnpm install
```

常用命令：

```bash
pnpm exec tsx src/cli.ts terms
pnpm exec tsx src/cli.ts export
pnpm exec tsx src/cli.ts run
```

也可以显式指定配置文件：

```bash
pnpm exec tsx src/cli.ts run --config ./config.json
```

或者直接传一段 JSON：

```bash
pnpm exec tsx src/cli.ts run --config-json '{"projectId":3489,"openai":{"model":"gpt-5.4-mini"},"review":{"rulesVersion":"v1","batchSize":10,"maxStrings":50,"force":true,"concurrency":1,"exportRetries":5,"exportWaitMs":3000,"prefilter":{"minOriginalLength":10,"minTranslationLength":10,"requireWordChar":true,"skipPunctuationOnly":true}},"prompts":{"system":"...","userTemplate":"..."},"rules":[...]}'
```

运行结果会写到 `data/results/`。审核参数、规则和提示词都在 [config.json](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/config.json)。

## 文档

- 运行时配置：[config.json](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/config.json)
- 配置 schema 与加载逻辑：[src/config/config.ts](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/src/config/config.ts)
- 审核规则、提示词与 I/O 规范：[docs/review-rules-and-prompts.md](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/docs/review-rules-and-prompts.md)
- Paratranz OpenAPI 文档副本：[docs/paratranz-api.yml](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/docs/paratranz-api.yml)
