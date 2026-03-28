# Review Rules, Prompts And I/O Spec

这份文档定义第一版审核规则、完整提示词全文，以及 LLM 输入输出格式。

实际运行时，模型、提示词模板、规则、批大小、导出重试和预过滤阈值都由 [src/config/config.ts](../src/config/config.ts) 提供。

## 当前实现

当前代码实现与本文档的对应关系：

- 规则定义：`src/config/rules.ts`
- 环境变量读取：`src/config/env.ts`
- Paratranz 客户端：`src/clients/paratranz.ts`
- OpenAI 审核客户端：`src/clients/openai.ts`
- 预过滤与分批：`src/core/batching.ts`
- artifact 下载与解压：`src/core/export.ts`
- 术语拉取：`src/core/terms.ts`
- 词条解析：`src/core/parse.ts`
- 缓存：`src/core/cache.ts`
- 结果汇总：`src/core/result.ts`
- CLI 入口：`src/cli.ts`

当前默认环境变量：

- `PARATRANZ_API_KEY`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`，默认值为 `gpt-4.1-mini`

## 设计原则

- 模型只输出有问题的词条
- 模型只基于输入中的原文、译文、术语表和规则做判断
- 模型输出必须是结构化 JSON
- 严重级别由本地规则映射决定，不要求模型输出
- 明显不需要审核的词条在本地预过滤，不发送给模型

## 调用结构

建议采用两段式提示：

1. system prompt
2. user prompt

## 审核规则

规则由本地维护，模型只返回命中的规则 ID。

### `R1` 明显输入错误

- 含义：译文存在较明确的输入错误
- 本地严重级别：`error`
- 本地分类：`typo`
- 典型情况：
  - 明显错别字
  - 明显漏字
  - 明显多字
  - 明显误输入字符

### `R2` 叠字或重复片段

- 含义：译文中出现明显重复，不符合正常表达
- 本地严重级别：`error`
- 本地分类：`duplicate_text`
- 典型情况：
  - 词语重复
  - 短句重复
  - 同一片段连续出现两次以上

### `R3` 不符合术语表

- 含义：译文明显违反术语表要求
- 本地严重级别：`error`
- 本地分类：`term_mismatch`
- 典型情况：
  - 术语已有明确指定译法但未遵守
  - 术语注释中有硬性要求但未遵守

### `R4` 原文与译文明显不对应

- 含义：原文整句话没有被翻出来，或译文里出现了整句原文中不存在的内容
- 本地严重级别：`error`
- 本地分类：`source_target_mismatch`
- 典型情况：
  - 原文中的整句信息完全没有出现在译文里
  - 译文额外写出一整句原文没有的信息
  - 明显整句漏译
  - 明显整句乱入

### `R5` 其他问题

- 含义：存在较明显的问题，但不属于前四条
- 本地严重级别：`error`
- 本地分类：`other`
- 典型情况：
  - 含义明显异常但不适合归入前四条
  - 结构明显有问题但不适合归入前四条
  - 其他应判为严重问题的情况

## 规则 JSON

程序发送给模型时建议使用：

```json
[
  { "id": "R1", "desc": "译文有明显输入错误，如错别字、漏字、多字或误输入字符" },
  { "id": "R2", "desc": "译文存在明显叠字或重复片段" },
  { "id": "R3", "desc": "译文明显不符合术语表" },
  { "id": "R4", "desc": "整句话未翻译，或译文出现整句原文中不存在的内容" },
  { "id": "R5", "desc": "存在其他严重问题" }
]
```

## 审核边界

- 只输出有问题的词条
- 允许一个词条命中多个规则
- `R5` 只用于其他严重问题
- 对简单规则可以只返回 `rid`
- 对需要补充说明的规则再加 `reason`

## 预过滤规则

以下词条默认不送审：

- 原文长度小于 `10` 字符
- 译文长度小于 `10` 字符
- 原文和译文都不包含单词字符
- 内容只有标点符号

预过滤在本地程序完成，不发送给模型。

## System Prompt 全文

```text
你是一个中文翻译审核助手。

输入包含：
- 审核规则
- 术语表
- 一批翻译词条

你的任务是找出有问题的词条，并按规则 ID 返回命中结果。

输出要求：
- 只输出有问题的词条
- 输出合法 JSON
- 输出字段尽量短
```

## User Prompt 全文

```text
请审核下面这批翻译词条。

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
{{STRINGS_JSON}}
```

## 输入格式

建议程序发送结构稳定的文本，其中规则、术语表、词条部分都使用 JSON。

### 术语表格式

建议传递精简结构：

```json
[
  {
    "term": "Save",
    "translation": "保存",
    "note": "UI 按钮统一使用“保存”"
  },
  {
    "term": "Load",
    "translation": "读取",
    "note": ""
  }
]
```

建议字段：

- `term`
- `translation`
- `note`
- `variants` 可选

### 词条输入格式

每条词条只发送以下字段：

```json
[
  { "key": "1", "o": "Start Game", "t": "开始游戏" },
  { "key": "2", "o": "Load", "t": "加载" }
]
```

字段约定：

- `key`：本地生成的短编号
- `o`：原文
- `t`：译文

程序侧保存短 key 映射表：

```json
{
  "1": "abxcsqweqw",
  "2": "chapter1.scene3.line0042"
}
```

模型返回后，再将短 key 替换回真实 key。

## 输出格式

模型输出必须是：

```json
{
  "issues": [
    {
      "key": "2",
      "hits": [
        { "rid": "R3", "reason": "术语表要求 Load 统一译为“读取”" }
      ]
    }
  ]
}
```

如果没有问题：

```json
{
  "issues": []
}
```

## Output Schema

顶层对象：

```json
{
  "issues": []
}
```

`issues` 中每项字段：

- `key`
  - 类型：`string`
  - 必填
- `hits`
  - 类型：`object[]`
  - 必填

`hits` 中每项字段：

- `rid`
  - 类型：`string`
  - 必填
- `reason`
  - 类型：`string`
  - 选填

要求：

- 同一个词条可命中多个规则
- `reason` 尽量简短
- 简单规则可省略 `reason`

## 输入输出示例

输入：

```json
[
  { "key": "1", "o": "Start Game", "t": "开始游戏" },
  { "key": "2", "o": "Load", "t": "加载" },
  { "key": "3", "o": "Welcome back.", "t": "欢迎欢迎回来。" }
]
```

输出：

```json
{
  "issues": [
    {
      "key": "2",
      "hits": [
        { "rid": "R3", "reason": "术语表要求 Load 统一译为“读取”" }
      ]
    },
    {
      "key": "3",
      "hits": [
        { "rid": "R2" }
      ]
    }
  ]
}
```

## 规则与严重级别映射

严重级别不由模型输出，而是由本地程序根据规则 ID 映射。

```json
{
  "R1": { "severity": "error", "category": "typo" },
  "R2": { "severity": "error", "category": "duplicate_text" },
  "R3": { "severity": "error", "category": "term_mismatch" },
  "R4": { "severity": "error", "category": "source_target_mismatch" },
  "R5": { "severity": "error", "category": "other" }
}
```

## 输出校验

程序侧需要校验：

- 必须是合法 JSON
- 顶层必须有 `issues`
- `issues` 必须是数组
- 每条 issue 的 `key` 必须存在于输入词条中
- `hits` 必须是数组
- `hits` 中每项必须有 `rid`

如果校验失败，建议重试一次。

重试补充提示：

```text
请重新输出合法 JSON。
顶层必须是 {"issues": [...]}。
每个 issue 必须包含 key、hits。
每个 hit 必须包含 rid，reason 可选。
```

## 项目级结果格式

模型输出是批次级结果，程序汇总后生成项目级结果文件。

```json
{
  "projectId": 12345,
  "generatedAt": "2026-03-28T04:00:00-05:00",
  "rulesVersion": "v1",
  "issues": [
    {
      "filePath": "ui/menu.json",
      "key": "2",
      "original": "Load",
      "translation": "加载",
      "severity": "error",
      "category": "term_mismatch",
      "hits": [
        {
          "rid": "R3",
          "reason": "术语表要求 Load 统一译为“读取”"
        }
      ]
    }
  ]
}
```

这里的 `filePath`、`original`、`translation`、`severity`、`category` 都由程序回填。

## 当前定稿

- `R1-R4` 为明确严重问题
- `R5` 为兜底严重问题
