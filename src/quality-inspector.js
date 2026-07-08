/**
 * quality-inspector.js
 *
 * Script Snap 产品质检模块。
 * 对跑测产出的 article + tweets 进行 LLM 多维度评分，
 * 输出结构化质检报告。
 *
 * 用法:
 *   node src/quality-inspector.js [--run-dir <path>] [--evidence-pack <path>]
 *
 * 输出:
 *   - quality-report.json（评分 + 问题清单 + 优化建议）
 *   - 控制台输出摘要
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { callLLM } = require('./llm-client');

// ─── 质检 Prompt ───────────────────────────────────────────────

function buildQualityPrompt(articleText, tweetsText, sourceUrl) {
  return `You are a senior product quality analyst for Script Snap, a Tech Transcript & Repurposing Engine.

Your job: evaluate the quality of auto-generated article and tweets from a YouTube video transcript.

SOURCE VIDEO: ${sourceUrl}

=== ARTICLE ===
${articleText}

=== TWEETS ===
${tweetsText}

Score each dimension from 1-5 (1=poor, 3=acceptable, 5=excellent) and provide specific feedback.

DIMENSIONS:

1. Fidelity (转录保真度)
   - Are the video's core arguments preserved?
   - Any obvious hallucination or fabrication?
   - Key data/quotes accurate?

2. Structure (结构化完整度)
   - Clear intro/body/conclusion?
   - Logical paragraph flow?
   - Reasonable section divisions?

3. Terminology (术语识别率)
   - Technical terms correctly preserved?
   - Domain vocabulary not mangled?
   - Abbreviations/brand names accurate?

4. Usability (内容可用性)
   - Blog-publishable quality?
   - Minimal manual editing needed?
   - Real value for tech creators?

5. Tweet Quality (推文质量)
   - Hook strength for X/Twitter?
   - Technical depth sufficient?
   - Ready to publish?

OUTPUT FORMAT (strict JSON, no markdown fences):
{
  "scores": {
    "fidelity": { "score": <1-5>, "note": "<specific feedback>" },
    "structure": { "score": <1-5>, "note": "<specific feedback>" },
    "terminology": { "score": <1-5>, "note": "<specific feedback>" },
    "usability": { "score": <1-5>, "note": "<specific feedback>" },
    "tweetQuality": { "score": <1-5>, "note": "<specific feedback>" }
  },
  "overallScore": <average>,
  "overallLabel": "<Pass|Warn|Fail>",
  "issues": [
    { "severity": "<critical|warning|info>", "dimension": "<dimension>", "description": "<what's wrong>" }
  ],
  "suggestions": [
    "<actionable improvement suggestion>"
  ]
}`;
}

function extractJSON(text) {
  // Try to parse directly
  try {
    return JSON.parse(text);
  } catch (e) {
    // Try to extract JSON from text (LLM might wrap it)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (e2) {
        // ignore
      }
    }
  }
  throw new Error('Could not extract valid JSON from LLM response');
}

// ─── 主流程 ────────────────────────────────────────────────────

function resolveRunDir(projectDir, explicitRunDir) {
  if (explicitRunDir) return explicitRunDir;
  const outputsDir = path.join(projectDir, 'outputs');
  if (!fs.existsSync(outputsDir)) return null;
  const dayDirs = fs.readdirSync(outputsDir, { withFileTypes: true })
    .filter(d => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name))
    .map(d => d.name)
    .sort((a, b) => b.localeCompare(a));
  if (dayDirs.length === 0) return null;
  const latestDay = path.join(outputsDir, dayDirs[0]);
  const runs = fs.readdirSync(latestDay, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name.startsWith('run-'))
    .map(d => d.name)
    .sort((a, b) => b.localeCompare(a));
  return runs.length > 0 ? path.join(latestDay, runs[0]) : null;
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('project-dir', { type: 'string', default: path.join(__dirname, '..') })
    .option('run-dir', { type: 'string', describe: 'Explicit run directory' })
    .option('evidence-pack', { type: 'string', describe: 'Explicit evidence pack path' })
    .parse();

  const projectDir = path.resolve(argv.projectDir);
  const runDir = resolveRunDir(projectDir, argv['run-dir']);
  if (!runDir) {
    console.error('[QUALITY] No run directory found.');
    process.exit(1);
  }

  // 读取 evidence pack
  const evidencePath = argv['evidence-pack'] || path.join(runDir, 'evidence-pack.json');
  if (!fs.existsSync(evidencePath)) {
    console.error(`[QUALITY] Evidence pack not found: ${evidencePath}`);
    process.exit(1);
  }

  const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf-8'));
  if (evidence.status !== 'success') {
    console.warn(`[QUALITY] Run status is "${evidence.status}", skipping quality inspection.`);
    process.exit(0);
  }

  const articleText = evidence.content?.articleText || '';
  const tweetsText = evidence.content?.tweetsText || '';
  const sourceUrl = evidence.sourceUrl || 'unknown';

  if (!articleText && !tweetsText) {
    console.warn('[QUALITY] No content to inspect.');
    process.exit(0);
  }

  console.log(`[QUALITY] Inspecting run: ${evidence.runId}`);
  console.log(`[QUALITY] Article: ${articleText.length} chars, Tweets: ${(tweetsText.match(/\[Tweet/g) || []).length} items`);

  // 调用 LLM 质检
  const prompt = buildQualityPrompt(articleText, tweetsText, sourceUrl);
  let llmOutput;
  try {
    llmOutput = await callLLM(prompt);
  } catch (e) {
    console.error(`[QUALITY] LLM call failed: ${e.message}`);
    // 降级：输出基础统计而非 LLM 评分
    const fallbackReport = {
      runId: evidence.runId,
      timestamp: new Date().toISOString(),
      sourceUrl,
      llmAvailable: false,
      fallbackStats: {
        articleChars: articleText.length,
        tweetsCount: (tweetsText.match(/\[Tweet/g) || []).length,
      },
      error: e.message,
    };
    const reportPath = path.join(runDir, 'quality-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(fallbackReport, null, 2), 'utf-8');
    console.log(`[QUALITY] Fallback report saved: ${reportPath}`);
    process.exit(0);
  }

  // 解析 LLM 输出
  let qualityResult;
  try {
    qualityResult = extractJSON(llmOutput);
  } catch (e) {
    console.error(`[QUALITY] Failed to parse LLM output: ${e.message}`);
    const rawPath = path.join(runDir, 'quality-inspector-raw.txt');
    fs.writeFileSync(rawPath, llmOutput, 'utf-8');
    console.log(`[QUALITY] Raw output saved: ${rawPath}`);
    process.exit(1);
  }

  // 构建完整报告
  const report = {
    runId: evidence.runId,
    timestamp: new Date().toISOString(),
    sourceUrl,
    llmAvailable: true,
    ...qualityResult,
  };

  // 保存
  const reportPath = path.join(runDir, 'quality-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`[QUALITY] Report saved: ${reportPath}`);

  // 输出摘要
  console.log('\n=== Quality Inspection Summary ===');
  console.log(`Overall: ${report.overallScore}/5 (${report.overallLabel})`);
  if (report.scores) {
    for (const [dim, val] of Object.entries(report.scores)) {
      console.log(`  ${dim}: ${val.score}/5 — ${val.note}`);
    }
  }
  if (report.issues && report.issues.length > 0) {
    console.log(`\nIssues (${report.issues.length}):`);
    for (const issue of report.issues) {
      console.log(`  [${issue.severity}] ${issue.dimension}: ${issue.description}`);
    }
  }
  if (report.suggestions && report.suggestions.length > 0) {
    console.log('\nSuggestions:');
    for (const s of report.suggestions) {
      console.log(`  → ${s}`);
    }
  }

  // 写入历史趋势
  appendQualityHistory(projectDir, report);

  // 写入 backlog（如有 critical/warning issues）
  if (report.issues && report.issues.length > 0) {
    appendBacklog(projectDir, report);
  }
}

// ─── 历史趋势 ──────────────────────────────────────────────────

function appendQualityHistory(projectDir, report) {
  const historyPath = path.join(projectDir, 'data', 'quality-history.json');
  const dataDir = path.join(projectDir, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  let history = [];
  if (fs.existsSync(historyPath)) {
    try {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    } catch (e) {
      console.warn(`[QUALITY] Failed to read history, starting fresh.`);
    }
  }

  history.push({
    runId: report.runId,
    timestamp: report.timestamp,
    sourceUrl: report.sourceUrl,
    overallScore: report.overallScore,
    overallLabel: report.overallLabel,
    scores: report.scores ? Object.fromEntries(
      Object.entries(report.scores).map(([k, v]) => [k, v.score])
    ) : null,
    issuesCount: report.issues?.length || 0,
    criticalCount: report.issues?.filter(i => i.severity === 'critical').length || 0,
  });

  // 保留最近 90 条
  if (history.length > 90) {
    history = history.slice(-90);
  }

  fs.writeFileSync(historyPath, JSON.stringify(history, null, 2), 'utf-8');
  console.log(`[QUALITY] History updated: ${history.length} entries`);
}

// ─── 问题回流 ──────────────────────────────────────────────────

function appendBacklog(projectDir, report) {
  const backlogPath = path.join(projectDir, 'data', 'quality-backlog.md');
  const dataDir = path.join(projectDir, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const lines = [];
  const now = new Date().toISOString().split('T')[0];

  for (const issue of (report.issues || [])) {
    if (issue.severity === 'critical' || issue.severity === 'warning') {
      lines.push(`- [${issue.severity.toUpperCase()}] [${now}] [${issue.dimension}] ${issue.description} (run: ${report.runId})`);
    }
  }

  if (lines.length === 0) return;

  let existing = '';
  if (fs.existsSync(backlogPath)) {
    existing = fs.readFileSync(backlogPath, 'utf-8');
  } else {
    existing = '# Quality Backlog\n\nAuto-generated by quality-inspector. Review and triage regularly.\n\n';
  }

  existing += `\n## ${now}\n\n${lines.join('\n')}\n`;
  fs.writeFileSync(backlogPath, existing, 'utf-8');
  console.log(`[QUALITY] Backlog updated: ${lines.length} new issues`);
}

main();
