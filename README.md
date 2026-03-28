# Paratranz String Reviewer

一个用于审阅 Paratranz 项目翻译词条的小工具。

项目目标是：

- 从 Paratranz 拉取项目最新导出包
- 拉取术语表
- 将词条分批交给 LLM 审阅
- 输出结构化问题文件，供后续处理

## 当前状态

第一版 CLI 已经实现，包含：

- `reviewer terms --project <id>`：拉取并保存术语表
- `reviewer export --project <id>`：触发导出、下载并解压项目文件
- `reviewer run --project <id>`：执行完整主链

当前实现使用：

- Node.js + TypeScript + pnpm
- Paratranz API 拉取 artifact 和术语表
- OpenAI Responses API 执行批量审核
- 本地 `data/` 目录保存 artifact、解压结果、术语、缓存和结果文件

已验证：

- 项目 `3489` 术语表拉取成功
- 项目 `3489` artifact 下载和解压成功
- 本地可解析出导出词条

## 常用命令

```bash
pnpm install
pnpm check
pnpm build
pnpm exec tsx src/cli.ts --help
pnpm exec tsx src/cli.ts terms --project 3489
pnpm exec tsx src/cli.ts export --project 3489
pnpm exec tsx src/cli.ts run --project 3489
```

## 文档

- 审核规则、提示词与 I/O 规范：[docs/review-rules-and-prompts.md](docs/review-rules-and-prompts.md)
- Paratranz OpenAPI 文档副本：[docs/paratranz-api.yml](docs/paratranz-api.yml)
- 本地实现计划：[AGENTS.md](AGENTS.md)
