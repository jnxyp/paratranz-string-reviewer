import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  getReviewRules,
  getRulesById,
  getRulesVersion,
  type ReviewRule,
} from "../config/rules.js";
import type { ReviewedIssue } from "./review.js";
import { writeJsonFile } from "../utils/json.js";
import { ensureParentDir } from "../utils/fs.js";

export interface ResultHit {
  rid: ReviewedIssue["hits"][number]["rid"];
  reason?: string;
  rule: ReviewRule;
}

export interface ProjectIssueResult {
  filePath: string;
  key: string;
  stringUrl: string;
  original: string;
  translation: string;
  fromCache: boolean;
  hits: ResultHit[];
}

export interface ProjectResult {
  projectId: number;
  generatedAt: string;
  model: string;
  reasoningEffort: string;
  rulesVersion: string;
  stats: {
    totalStringCount: number;
    cachedStringCount: number;
    reviewedStringCount: number;
    issueStringCount: number;
    issueCount: number;
    cachedIssueCount: number;
    newIssueCount: number;
  };
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  rules: ReviewRule[];
  issues: ProjectIssueResult[];
}

export interface SavedProjectResultPaths {
  htmlPath: string;
  jsonPath: string;
}

export function buildProjectResult(input: {
  projectId: number;
  model: string;
  reasoningEffort: string;
  totalStringCount: number;
  cachedStringCount: number;
  reviewedStringCount: number;
  usage: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  issues: ReviewedIssue[];
}): ProjectResult {
  const reviewRules = getReviewRules();
  const rulesById = getRulesById();

  return {
    projectId: input.projectId,
    generatedAt: new Date().toISOString(),
    model: input.model,
    reasoningEffort: input.reasoningEffort,
    rulesVersion: getRulesVersion(),
    stats: {
      totalStringCount: input.totalStringCount,
      cachedStringCount: input.cachedStringCount,
      reviewedStringCount: input.reviewedStringCount,
      issueStringCount: input.issues.length,
      issueCount: input.issues.reduce((sum, issue) => sum + issue.hits.length, 0),
      cachedIssueCount: input.issues
        .filter((issue) => issue.fromCache)
        .reduce((sum, issue) => sum + issue.hits.length, 0),
      newIssueCount: input.issues
        .filter((issue) => !issue.fromCache)
        .reduce((sum, issue) => sum + issue.hits.length, 0),
    },
    usage: input.usage,
    rules: reviewRules,
    issues: input.issues.map((issue) => {
      return {
        filePath: issue.filePath,
        key: issue.key,
        stringUrl: buildStringUrl(input.projectId, issue.key),
        original: issue.original,
        translation: issue.translation,
        fromCache: issue.fromCache,
        hits: issue.hits.map((hit) => ({
          rid: hit.rid,
          reason: hit.reason,
          rule: getRequiredRule(rulesById, hit.rid),
        })),
      };
    }),
  };
}

function buildStringUrl(projectId: number, key: string): string {
  return `https://paratranz.cn/projects/${projectId}/strings?key=${encodeURIComponent(key)}`;
}

function getRequiredRule(
  rulesById: Record<string, ReviewRule>,
  ruleId: string,
): ReviewRule {
  const rule = rulesById[ruleId];
  if (!rule) {
    throw new Error(`Unknown rule id in result: ${ruleId}`);
  }
  return rule;
}

export function saveProjectResult(input: {
  dataDir: string;
  projectId: number;
  result: ProjectResult;
}): SavedProjectResultPaths {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = join(process.cwd(), "output");
  const basePath = join(outputDir, `project-${input.projectId}-${stamp}`);
  const jsonPath = `${basePath}.json`;
  const htmlPath = `${basePath}.html`;

  writeJsonFile(jsonPath, input.result);
  writeHtmlFile(htmlPath, renderProjectResultHtml(input.result));

  return {
    htmlPath,
    jsonPath,
  };
}

function writeHtmlFile(path: string, content: string): void {
  ensureParentDir(path);
  writeFileSync(path, content, "utf8");
}

function renderProjectResultHtml(result: ProjectResult): string {
  const title = `Paratranz 审核报告 - 项目 ${result.projectId}`;
  const dataJson = JSON.stringify(result)
    .replaceAll("&", "\\u0026")
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
  const statsCardsHtml = [
    renderStatCard("词条总数", formatNumber(result.stats.totalStringCount), "number"),
    renderStatCard("实际审核", formatNumber(result.stats.reviewedStringCount), "number"),
    renderStatCard("问题词条", formatNumber(result.stats.issueStringCount), "number"),
    renderStatCard("问题命中", formatNumber(result.stats.issueCount), "number"),
    renderStatCard("缓存命中", formatNumber(result.stats.cachedIssueCount), "number"),
    renderStatCard("新增命中", formatNumber(result.stats.newIssueCount), "number"),
    renderStatCard("模型", result.model, "text"),
    renderStatCard("推理强度", result.reasoningEffort, "text"),
    renderStatCard("输入 Token", formatNumber(result.usage.inputTokens), "number"),
    renderStatCard("输出 Token", formatNumber(result.usage.outputTokens), "number"),
    renderStatCard("总 Token", formatNumber(result.usage.totalTokens), "number"),
    renderStatCard("规则版本", result.rulesVersion, "text"),
  ].join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f3f6fb;
      --panel: #ffffff;
      --panel-strong: #fdfefe;
      --line: #d9e2ef;
      --text: #223043;
      --muted: #6c7b8f;
      --accent: #007bff;
      --accent-soft: #e8f2ff;
      --danger: #d9534f;
      --danger-soft: #fff0ef;
      --cache: #6c7b8f;
      --cache-soft: #eef3f8;
      --shadow: 0 16px 36px rgba(31, 54, 88, 0.08);
      font-family: "Segoe UI", "PingFang SC", "Noto Sans SC", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background:
        radial-gradient(circle at top left, rgba(0, 123, 255, 0.10), transparent 24%),
        linear-gradient(180deg, #f8fbff 0%, var(--bg) 100%);
      color: var(--text);
    }
    a { color: var(--accent); }
    .page {
      width: min(1200px, calc(100vw - 32px));
      margin: 32px auto 64px;
    }
    .hero, .panel, .issue {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 20px;
      box-shadow: var(--shadow);
    }
    .hero {
      padding: 28px;
      margin-bottom: 20px;
      background:
        linear-gradient(135deg, rgba(0, 123, 255, 0.08), rgba(255,255,255,0.94)),
        var(--panel-strong);
    }
    h1, h2, h3, p { margin: 0; }
    .hero h1 { font-size: 32px; margin-bottom: 8px; }
    .hero p { color: var(--muted); }
    .meta {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-top: 16px;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 8px 12px;
      border-radius: 999px;
      border: 1px solid var(--line);
      background: rgba(255,255,255,0.7);
      color: var(--muted);
      font-size: 13px;
    }
    .layout {
      display: grid;
      grid-template-columns: 320px 1fr;
      gap: 20px;
      align-items: start;
    }
    .sidebar {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .panel { padding: 20px; }
    .section-title {
      font-size: 18px;
      margin-bottom: 14px;
    }
    .section-title + .section-title {
      margin-top: 22px;
    }
    .data-stack {
      display: flex;
      flex-direction: column;
      gap: 14px;
      margin-bottom: 18px;
    }
    .stats {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .stat {
      flex: 0 1 auto;
      border: 1px solid var(--line);
      border-radius: 16px;
      padding: 14px;
      background: rgba(255,255,255,0.55);
    }
    .stat strong {
      display: block;
      margin-bottom: 4px;
      line-height: 1.05;
      color: var(--text);
    }
    .stat strong.value-number {
      font-size: clamp(18px, 0.8vw + 15px, 26px);
      white-space: nowrap;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.01em;
    }
    .stat strong.value-text {
      font-size: clamp(16px, 0.5vw + 14px, 22px);
      overflow-wrap: anywhere;
      word-break: break-word;
    }
    .stat span {
      color: var(--muted);
      font-size: 13px;
      line-height: 1.35;
    }
    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 16px;
    }
    .filter-toolbar {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .rule-option {
      display: flex;
      gap: 10px;
      align-items: flex-start;
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
      background: rgba(255,255,255,0.55);
      cursor: pointer;
      transition: border-color 0.18s ease, background-color 0.18s ease, transform 0.18s ease;
    }
    .rule-option:hover {
      border-color: rgba(0, 123, 255, 0.35);
      background: rgba(232, 242, 255, 0.7);
    }
    .rule-option input { margin-top: 3px; }
    .rule-option strong {
      display: block;
      margin-bottom: 4px;
    }
    .rule-option span {
      display: block;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      justify-content: space-between;
    }
    .toolbar .summary {
      color: var(--muted);
      font-size: 14px;
    }
    .pagination {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
    }
    .pagination input {
      width: 72px;
      padding: 9px 10px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel-strong);
      color: var(--text);
      font: inherit;
      text-align: center;
    }
    .page-info {
      color: var(--muted);
      font-size: 13px;
      margin-right: 4px;
    }
    button {
      appearance: none;
      border: 1px solid var(--line);
      background: var(--panel-strong);
      color: var(--text);
      border-radius: 999px;
      padding: 9px 14px;
      cursor: pointer;
      font: inherit;
    }
    .issues {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .issue {
      padding: 18px;
      background: var(--panel-strong);
    }
    .issue-head {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      margin-bottom: 12px;
    }
    .issue-key {
      display: inline-block;
      font-size: 18px;
      line-height: 1.35;
      word-break: break-all;
      color: var(--accent);
      text-decoration: none;
      font-weight: 600;
    }
    .issue-key:hover {
      text-decoration: underline;
    }
    .issue-badges {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    .badge {
      border-radius: 999px;
      padding: 7px 10px;
      font-size: 12px;
      border: 1px solid var(--line);
      background: var(--accent-soft);
      color: var(--accent);
      font-weight: 600;
    }
    .badge.cache {
      background: var(--cache-soft);
      color: var(--cache);
    }
    .badge.hit {
      background: var(--danger-soft);
      color: var(--danger);
    }
    .cols {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
      margin-bottom: 12px;
    }
    .block {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
      background: rgba(255,255,255,0.55);
    }
    .block h3 {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 8px;
    }
    .block pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: "SFMono-Regular", Consolas, monospace;
      font-size: 13px;
      line-height: 1.5;
      max-height: 260px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .hits {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 10px;
    }
    .hit {
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 12px;
      background: rgba(255,255,255,0.55);
    }
    .hit p {
      color: var(--text);
      line-height: 1.55;
      margin: 0;
    }
    .hit-rule {
      margin-top: 8px;
      color: var(--muted);
      font-size: 12px;
      line-height: 1.45;
    }
    .empty {
      border: 1px dashed var(--line);
      border-radius: 16px;
      padding: 28px;
      text-align: center;
      color: var(--muted);
      background: rgba(255,255,255,0.45);
    }
    @media (max-width: 980px) {
      .layout { grid-template-columns: 1fr; }
    }
    @media (max-width: 720px) {
      .page { width: min(100vw - 20px, 100%); margin-top: 20px; }
      .hero { padding: 22px; }
      .hero h1 { font-size: 26px; }
      .cols { grid-template-columns: 1fr; }
      .stat {
        width: 100%;
      }
      .issue-head { flex-direction: column; }
      .issue-badges { justify-content: flex-start; }
    }
  </style>
</head>
<body>
  <div class="page">
    <section class="hero">
      <h1>${escapeHtml(title)}</h1>
      <p>本地交互报告。可按规则筛选，点击词条链接可直接跳转到 Paratranz。</p>
      <div class="meta">
        <span class="pill">项目 ${result.projectId}</span>
        <span class="pill">模型 ${escapeHtml(result.model)}</span>
        <span class="pill">推理强度 ${escapeHtml(result.reasoningEffort)}</span>
        <span class="pill">规则版本 ${escapeHtml(result.rulesVersion)}</span>
        <span class="pill">生成时间 ${escapeHtml(result.generatedAt)}</span>
      </div>
    </section>
    <div class="layout">
      <aside class="sidebar">
        <section class="panel">
          <h2 class="section-title">按规则筛选</h2>
          <div class="filter-toolbar">
            <button id="select-all" type="button">全选</button>
            <button id="clear-all" type="button">清空</button>
          </div>
          <div class="filter-group" id="rule-filters"></div>
        </section>
        <section class="panel">
          <h2 class="section-title">数据统计</h2>
          <div class="data-stack">
            <div class="stats">${statsCardsHtml}</div>
          </div>
        </section>
      </aside>
      <main class="panel">
        <div class="toolbar">
          <span class="summary" id="result-summary"></span>
          <div class="pagination">
            <span class="page-info" id="page-info-top"></span>
            <button id="prev-page-top" type="button">上一页</button>
            <input id="page-input-top" type="number" min="1" step="1" inputmode="numeric" aria-label="页码">
            <button id="go-page-top" type="button">跳转</button>
            <button id="next-page-top" type="button">下一页</button>
          </div>
        </div>
        <div class="issues" id="issues"></div>
        <div class="toolbar">
          <span class="summary"></span>
          <div class="pagination">
            <span class="page-info" id="page-info-bottom"></span>
            <button id="prev-page-bottom" type="button">上一页</button>
            <input id="page-input-bottom" type="number" min="1" step="1" inputmode="numeric" aria-label="页码">
            <button id="go-page-bottom" type="button">跳转</button>
            <button id="next-page-bottom" type="button">下一页</button>
          </div>
        </div>
      </main>
    </div>
  </div>
  <script id="report-data" type="application/json">${dataJson}</script>
  <script>
    const report = JSON.parse(document.getElementById("report-data").textContent);
    const rules = report.rules;
    const issues = report.issues;
    const state = {
      selectedRules: new Set(rules.map((rule) => rule.id)),
    };

    const ruleFilters = document.getElementById("rule-filters");
    const issuesRoot = document.getElementById("issues");
    const resultSummary = document.getElementById("result-summary");
    const pageInfos = [
      document.getElementById("page-info-top"),
      document.getElementById("page-info-bottom"),
    ];
    const prevPageButtons = [
      document.getElementById("prev-page-top"),
      document.getElementById("prev-page-bottom"),
    ];
    const nextPageButtons = [
      document.getElementById("next-page-top"),
      document.getElementById("next-page-bottom"),
    ];
    const pageInputs = [
      document.getElementById("page-input-top"),
      document.getElementById("page-input-bottom"),
    ];
    const goPageButtons = [
      document.getElementById("go-page-top"),
      document.getElementById("go-page-bottom"),
    ];
    const pageSize = 20;
    let currentPage = 1;
    const ruleNameById = {
      R1: "明显输入错误",
      R2: "叠字或重复片段",
      R3: "不符合术语表",
      R4: "原文与译文明显不对应",
    };

    function escapeHtml(value) {
      return value
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
    }

    function getRuleDisplayName(hit) {
      return ruleNameById[hit.rid] || hit.rule.criteria;
    }

    function renderRuleFilters() {
      ruleFilters.innerHTML = rules.map((rule) => {
        const checked = state.selectedRules.has(rule.id) ? "checked" : "";
        return '<label class="rule-option">' +
          '<input type="checkbox" data-rule-id="' + escapeHtml(rule.id) + '" ' + checked + '>' +
          '<div>' +
            '<strong>' + escapeHtml(rule.id) + '</strong>' +
            '<span>' + escapeHtml(rule.criteria) + '</span>' +
          '</div>' +
        '</label>';
      }).join("");

      ruleFilters.querySelectorAll("input[type=checkbox]").forEach((input) => {
        input.addEventListener("change", () => {
          const ruleId = input.getAttribute("data-rule-id");
          if (!ruleId) return;
          if (input.checked) {
            state.selectedRules.add(ruleId);
          } else {
            state.selectedRules.delete(ruleId);
          }
          currentPage = 1;
          renderIssues();
        });
      });
    }

    function getVisibleIssues() {
      if (state.selectedRules.size === 0) {
        return [];
      }

      return issues
        .map((issue) => ({
          ...issue,
          hits: issue.hits.filter((hit) => state.selectedRules.has(hit.rid)),
        }))
        .filter((issue) => issue.hits.length > 0);
    }

    function renderIssues() {
      const visibleIssues = getVisibleIssues();
      const visibleHitCount = visibleIssues.reduce((sum, issue) => sum + issue.hits.length, 0);
      const totalPages = Math.max(1, Math.ceil(visibleIssues.length / pageSize));
      if (currentPage > totalPages) {
        currentPage = totalPages;
      }
      const startIndex = (currentPage - 1) * pageSize;
      const pagedIssues = visibleIssues.slice(startIndex, startIndex + pageSize);

      resultSummary.textContent =
        "当前显示问题词条 " + visibleIssues.length + " 条 · 命中 " + visibleHitCount + " 项";
      pageInfos.forEach((item) => {
        item.textContent = "第 " + currentPage + " / " + totalPages + " 页";
      });
      pageInputs.forEach((input) => {
        input.value = String(currentPage);
        input.max = String(totalPages);
      });
      prevPageButtons.forEach((button) => {
        button.disabled = currentPage <= 1;
      });
      nextPageButtons.forEach((button) => {
        button.disabled = currentPage >= totalPages;
      });

      if (visibleIssues.length === 0) {
        issuesRoot.innerHTML = '<div class="empty">当前筛选条件下没有结果。</div>';
        return;
      }

      issuesRoot.innerHTML = pagedIssues.map((issue) => {
        const badges = issue.hits
          .map((hit) => '<span class="badge hit">' + escapeHtml(hit.rid) + '</span>')
          .join("");
          const cacheBadge = issue.fromCache ? '<span class="badge cache">来自缓存</span>' : "";
        const hitsHtml = issue.hits.map((hit) => {
          const explanation = hit.reason || "没有附加说明。";
          return '<div class="hit">' +
            '<p>' + escapeHtml(explanation) + '</p>' +
            '<div class="hit-rule">' + escapeHtml(hit.rid) + ' · ' + escapeHtml(getRuleDisplayName(hit)) + '</div>' +
          '</div>';
        }).join("");

        return '<article class="issue">' +
          '<div class="issue-head">' +
            '<div>' +
              '<a class="issue-key" href="' + escapeHtml(issue.stringUrl) + '" target="_blank" rel="noreferrer">' + escapeHtml(issue.key) + '</a>' +
            '</div>' +
            '<div class="issue-badges">' + cacheBadge + badges + '</div>' +
          '</div>' +
          '<div class="cols">' +
            '<div class="block"><h3>原文</h3><pre>' + escapeHtml(issue.original) + '</pre></div>' +
            '<div class="block"><h3>译文</h3><pre>' + escapeHtml(issue.translation) + '</pre></div>' +
          '</div>' +
          '<div class="hits">' + hitsHtml + '</div>' +
        '</article>';
      }).join("");
    }

    function scrollToPageTop() {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }

    function goToPage(page) {
      const visibleIssues = getVisibleIssues();
      const totalPages = Math.max(1, Math.ceil(visibleIssues.length / pageSize));
      const nextPage = Math.min(Math.max(page, 1), totalPages);
      if (nextPage === currentPage) {
        return;
      }
      currentPage = nextPage;
      renderIssues();
      scrollToPageTop();
    }

    document.getElementById("select-all").addEventListener("click", () => {
      state.selectedRules = new Set(rules.map((rule) => rule.id));
      currentPage = 1;
      renderRuleFilters();
      renderIssues();
    });

    document.getElementById("clear-all").addEventListener("click", () => {
      state.selectedRules = new Set();
      currentPage = 1;
      renderRuleFilters();
      renderIssues();
    });

    prevPageButtons.forEach((button) => {
      button.addEventListener("click", () => {
        goToPage(currentPage - 1);
      });
    });

    nextPageButtons.forEach((button) => {
      button.addEventListener("click", () => {
        goToPage(currentPage + 1);
      });
    });

    goPageButtons.forEach((button, index) => {
      button.addEventListener("click", () => {
        const raw = Number.parseInt(pageInputs[index].value, 10);
        if (Number.isNaN(raw)) {
          pageInputs[index].value = String(currentPage);
          return;
        }
        goToPage(raw);
      });
    });

    pageInputs.forEach((input, index) => {
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        goPageButtons[index].click();
      });
    });

    renderRuleFilters();
    renderIssues();
  </script>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function renderStatCard(
  label: string,
  value: string,
  kind: "number" | "text",
): string {
  return `<div class="stat"><strong class="value-${kind}">${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}
