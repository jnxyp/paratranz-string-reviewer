# Paratranz String Reviewer

一个用于审阅 Paratranz 项目翻译词条的小工具。

项目目标是：

- 从 Paratranz 拉取项目最新导出包
- 拉取术语表
- 将词条分批交给 LLM 审阅
- 输出结构化问题文件，供后续处理

## 文档

- 审核规则、提示词与 I/O 规范：[docs/review-rules-and-prompts.md](docs/review-rules-and-prompts.md)
- Paratranz OpenAPI 文档副本：[docs/paratranz-api.yml](docs/paratranz-api.yml)
- 本地实现计划：[AGENTS.md](AGENTS.md)
