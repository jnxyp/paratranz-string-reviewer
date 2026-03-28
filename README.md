# Paratranz String Reviewer

一个用于审阅 Paratranz 项目翻译词条的小工具。

主流程是：
- 拉取最新 artifact
- 拉取术语表
- 过滤可审核词条
- 分批调用 LLM 审核
- 输出结构化结果到 `output/`

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
pnpm terms
pnpm export
pnpm review
```

推荐先这样跑：

```bash
pnpm review
```

如果想忽略缓存：

```bash
pnpm review --no-cache
```

清空缓存：

```bash
pnpm clear-cache
```

审核参数、规则和提示词都在 [config.json](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/config.json)。  
CLI 也支持用参数临时覆盖 `project`、`model`、`batch-size`、`concurrency` 和 `no-cache`。

## 文档

- 运行时配置：[config.json](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/config.json)
- 配置 schema 与加载逻辑：[src/config/config.ts](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/src/config/config.ts)
- 审核规则、提示词与 I/O 规范：[docs/review-rules-and-prompts.md](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/docs/review-rules-and-prompts.md)
- Paratranz OpenAPI 文档副本：[docs/paratranz-api.yml](/home/jn_xyp/ProjectsLocal/paratranz-string-reviewer/docs/paratranz-api.yml)
