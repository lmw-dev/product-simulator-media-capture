const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const DEFAULT_CHANNEL_ID = '1489176810410479696';

function readLatestMeta(projectDir) {
  const metaPath = path.join(projectDir, 'outputs', 'latest-run-meta.json');
  if (!fs.existsSync(metaPath)) {
    return null;
  }

  try {
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
    return {
      metaPath,
      meta
    };
  } catch (error) {
    console.warn(`[REPORT] Failed to parse latest-run-meta.json: ${error.message}`);
    return null;
  }
}

function listRunDirectories(outputsDir) {
  if (!fs.existsSync(outputsDir)) {
    return [];
  }

  const dayDirs = fs.readdirSync(outputsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map(entry => entry.name)
    .sort((a, b) => b.localeCompare(a));

  const runDirs = [];
  for (const dayDir of dayDirs) {
    const absDayDir = path.join(outputsDir, dayDir);
    const dayRuns = fs.readdirSync(absDayDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith('run-'))
      .map(entry => path.join(absDayDir, entry.name));
    runDirs.push(...dayRuns);
  }

  return runDirs.sort((a, b) => {
    const aMtime = fs.statSync(a).mtimeMs;
    const bMtime = fs.statSync(b).mtimeMs;
    return bMtime - aMtime;
  });
}

function resolveRunDir(explicitRunDir, projectDir) {
  if (explicitRunDir) {
    return path.resolve(explicitRunDir);
  }

  const outputsDir = path.join(projectDir, 'outputs');
  const runDirs = listRunDirectories(outputsDir);
  if (runDirs.length === 0) {
    throw new Error(`No run directories found under ${outputsDir}`);
  }
  return runDirs[0];
}

function safeResolveRunDir(projectDir) {
  try {
    return resolveRunDir(null, projectDir);
  } catch (_) {
    return null;
  }
}

function readEvidencePack(runDir) {
  const evidencePath = path.join(runDir, 'evidence-pack.json');
  if (!fs.existsSync(evidencePath)) {
    throw new Error(`Missing evidence pack: ${evidencePath}`);
  }
  return {
    evidencePath,
    evidence: JSON.parse(fs.readFileSync(evidencePath, 'utf-8'))
  };
}

function countTweets(tweetsText) {
  if (!tweetsText || typeof tweetsText !== 'string') {
    return 0;
  }

  const tagged = tweetsText.match(/\[Tweet\s+\d+\]/g);
  if (tagged && tagged.length > 0) {
    return tagged.length;
  }

  return tweetsText.split('\n---\n').filter(Boolean).length;
}

function detectStructuredComponents(articleText) {
  if (!articleText) {
    return {
      hasTable: false,
      hasCallout: false
    };
  }

  const hasTable = /\|.+\|/.test(articleText);
  const hasCallout = /(^|\n)>\s*\[!|\n>\s/.test(articleText);
  return {
    hasTable,
    hasCallout
  };
}

function computeReview(evidence) {
  const articleText = evidence.content?.articleText || '';
  const tweetsText = evidence.content?.tweetsText || '';
  const validation = evidence.validation || {};
  const status = evidence.status || 'unknown';
  const stage = evidence.stage || 'unknown';
  const runtime = evidence.runtime || {};

  const articleChars = articleText.length;
  const tweetsCount = countTweets(tweetsText);
  const structured = detectStructuredComponents(articleText);
  const hasTermScriptSnap = /script\s*snap/i.test(articleText);
  const extractionLikelyIncomplete =
    !validation.articlePresent ||
    !validation.tweetsPresent ||
    validation.articleEmpty ||
    validation.tweetsEmpty ||
    articleChars < 120;

  let statusLabel = '❌ 失败';
  if (status === 'success') {
    statusLabel = '✅ 成功';
  } else if (status === 'timeout' || status === 'loading_stuck') {
    statusLabel = '⚠️ 超时';
  }

  let reviewLevel = 'Fail';
  if (status === 'success' && !extractionLikelyIncomplete && (structured.hasTable || structured.hasCallout)) {
    reviewLevel = 'Pass';
  } else if (status === 'success') {
    reviewLevel = 'Warning';
  }

  return {
    statusLabel,
    reviewLevel,
    stage,
    articleChars,
    tweetsCount,
    terminologyNote: hasTermScriptSnap
      ? '术语初评通过：检测到 Script Snap 相关术语。'
      : '术语初评待人工复核：未检测到 Script Snap 相关术语。',
    structureNote: `结构化组件检测：Table=${structured.hasTable ? 'Yes' : 'No'}, Callout=${structured.hasCallout ? 'Yes' : 'No'}.`,
    extractionNote: extractionLikelyIncomplete
      ? '提取完整性：存在空内容/过短/缺失字段，疑似未完整提取。'
      : '提取完整性：Article 与 Tweets 均存在且内容长度正常。',
    errorState: validation.errorState || null,
    durationMs: typeof runtime.durationMs === 'number' ? runtime.durationMs : null
  };
}

function computeFallbackReview(meta = {}) {
  const status = meta.status || 'unknown';

  let statusLabel = '❌ 失败';
  if (status === 'success') {
    statusLabel = '✅ 成功';
  } else if (status === 'timeout' || status === 'loading_stuck') {
    statusLabel = '⚠️ 超时';
  }

  return {
    statusLabel,
    reviewLevel: status === 'success' ? 'Warning' : 'Fail',
    stage: meta.stage || 'preflight',
    articleChars: 0,
    tweetsCount: 0,
    terminologyNote: '术语初评无法执行：缺少 evidence-pack 内容。',
    structureNote: '结构化组件检测无法执行：缺少 evidence-pack 内容。',
    extractionNote: '提取完整性无法执行：缺少 evidence-pack 内容。',
    errorState: meta.errorState || 'No evidence-pack generated in this run.',
    durationMs: typeof meta.durationMs === 'number' ? meta.durationMs : null
  };
}

function normalizeReviewLevel(level) {
  const normalized = String(level || '').trim().toLowerCase();
  if (normalized === 'pass') {
    return 'Pass';
  }
  if (normalized === 'warning' || normalized === 'warn') {
    return 'Warning';
  }
  return 'Fail';
}

function stricterReviewLevel(a, b) {
  const rank = {
    Pass: 1,
    Warning: 2,
    Fail: 3
  };
  const aNorm = normalizeReviewLevel(a);
  const bNorm = normalizeReviewLevel(b);
  return rank[aNorm] >= rank[bNorm] ? aNorm : bNorm;
}

function truncateForModel(text, maxChars) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  if (text.length <= maxChars) {
    return text;
  }
  return `${text.slice(0, maxChars)}\n...[truncated ${text.length - maxChars} chars]`;
}

function sanitizeJsonString(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  return raw.trim();
}

function parseJsonFromText(raw) {
  const cleaned = sanitizeJsonString(raw);

  try {
    return JSON.parse(cleaned);
  } catch (_) {
    // Try coarse extraction from first '{' to last '}'.
  }

  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start >= 0 && end > start) {
    const candidate = cleaned.slice(start, end + 1);
    return JSON.parse(candidate);
  }

  throw new Error('No valid JSON object found in model response');
}

function extractTextFromOpenClawAgentJson(payload) {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const directCandidates = [
    payload.reply,
    payload.response,
    payload.output,
    payload.text,
    payload.content
  ];
  for (const candidate of directCandidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
    if (candidate && typeof candidate === 'object') {
      if (typeof candidate.text === 'string' && candidate.text.trim()) {
        return candidate.text;
      }
      if (typeof candidate.content === 'string' && candidate.content.trim()) {
        return candidate.content;
      }
    }
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (typeof msg?.content === 'string' && msg.content.trim()) {
      return msg.content;
    }
    if (typeof msg?.text === 'string' && msg.text.trim()) {
      return msg.text;
    }
  }

  const payloads = Array.isArray(payload?.result?.payloads) ? payload.result.payloads : [];
  for (let i = payloads.length - 1; i >= 0; i -= 1) {
    const item = payloads[i];
    if (typeof item?.text === 'string' && item.text.trim()) {
      return item.text;
    }
  }

  return '';
}

function buildLlmReviewPrompt({ evidence, heuristic, maxInputChars }) {
  const articleExcerpt = truncateForModel(evidence.content?.articleText || '', maxInputChars);
  const tweetsExcerpt = truncateForModel(evidence.content?.tweetsText || '', maxInputChars);
  const payload = {
    runId: evidence.runId || 'N/A',
    sourceUrl: evidence.sourceUrl || 'N/A',
    status: evidence.status || 'unknown',
    stage: evidence.stage || 'unknown',
    durationMs: evidence.runtime?.durationMs ?? null,
    articleChars: heuristic.articleChars,
    tweetsCount: heuristic.tweetsCount,
    validation: evidence.validation || {},
    articleExcerpt,
    tweetsExcerpt
  };

  return [
    'You are reviewing a Script Snap simulation run for product viability.',
    'Return STRICT JSON only. No markdown, no commentary.',
    'Use this exact schema:',
    '{"reviewLevel":"Pass|Warning|Fail","feasibility":"Go|Caution|No-Go","confidence":"low|medium|high","summary":"string <= 120 chars","risks":["string"],"recommendations":["string"]}',
    '',
    'Scoring intent:',
    '- Pass: output quality is strong and viable for product use today.',
    '- Warning: usable but quality risk exists and needs follow-up.',
    '- Fail: output quality is not viable for product acceptance.',
    '',
    'Input JSON:',
    JSON.stringify(payload)
  ].join('\n');
}

function runLlmReviewWithOpenClaw({ evidence, heuristic, llmAgent, llmSessionId, llmTimeoutSec, maxInputChars }) {
  const prompt = buildLlmReviewPrompt({
    evidence,
    heuristic,
    maxInputChars
  });

  const args = ['agent', '--json', '--timeout', String(llmTimeoutSec), '--thinking', 'low'];
  if (llmSessionId) {
    args.push('--session-id', llmSessionId);
  } else {
    args.push('--agent', llmAgent);
  }
  args.push('--message', prompt);

  const result = spawnSync('openclaw', args, { encoding: 'utf-8' });
  if (result.error) {
    throw new Error(`OpenClaw LLM execution failed: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`OpenClaw LLM exit ${result.status}: ${result.stderr || result.stdout}`);
  }

  const stdout = (result.stdout || '').trim();
  if (!stdout) {
    throw new Error('OpenClaw LLM returned empty output');
  }

  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch (_) {
    payload = { raw: stdout };
  }

  let modelId =
    payload.model ||
    payload.modelId ||
    payload?.result?.meta?.agentMeta?.model ||
    payload?.usage?.model ||
    'unknown';

  if (modelId === 'unknown') {
    const modelResult = spawnSync('openclaw', ['models', 'status', '--json'], { encoding: 'utf-8' });
    if (modelResult.status === 0 && modelResult.stdout) {
      try {
        const modelPayload = JSON.parse(modelResult.stdout);
        modelId = modelPayload.resolvedDefault || modelPayload.defaultModel || modelId;
      } catch (_) {
        // keep unknown
      }
    }
  }

  const responseText = extractTextFromOpenClawAgentJson(payload);
  if (!responseText || !responseText.trim()) {
    throw new Error('OpenClaw LLM response text was empty or unrecognized');
  }

  const parsed = parseJsonFromText(responseText);
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('OpenClaw LLM response is not a JSON object');
  }
  if (!parsed.reviewLevel) {
    throw new Error('OpenClaw LLM response missing required field: reviewLevel');
  }
  if (!parsed.feasibility) {
    throw new Error('OpenClaw LLM response missing required field: feasibility');
  }

  const reviewLevel = normalizeReviewLevel(parsed.reviewLevel);
  const feasibility = ['Go', 'Caution', 'No-Go'].includes(parsed.feasibility) ? parsed.feasibility : 'Caution';
  const confidence = ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'medium';

  return {
    provider: 'openclaw-agent',
    modelId,
    reviewLevel,
    feasibility,
    confidence,
    summary: String(parsed.summary || parsed.reasoning || '').trim() || 'No summary provided by model.',
    risks: Array.isArray(parsed.risks) ? parsed.risks.map(item => String(item)) : [],
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.map(item => String(item)) : []
  };
}

function formatDuration(durationMs) {
  if (typeof durationMs !== 'number' || durationMs < 0) {
    return 'N/A';
  }
  const totalSec = Math.round(durationMs / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${min}m ${sec}s`;
}

function buildReviewSummaryMarkdown({ runDir, evidencePath, evidence, review, llmReview }) {
  const lines = [
    `# Review Summary: ${evidence.runId || path.basename(runDir)}`,
    '',
    '## Execution Snapshot',
    `- Status: ${review.statusLabel} (\`${evidence.status || 'unknown'}\`)`,
    `- Review Level (Final): **${review.finalReviewLevel || review.reviewLevel}**`,
    `- Review Level (Heuristic): ${review.reviewLevel}`,
    `- Stage: \`${review.stage}\``,
    `- Source URL: ${evidence.sourceUrl || 'N/A'}`,
    `- Duration: ${formatDuration(review.durationMs)}`,
    '',
    '## Metrics',
    `- Article Chars: ${review.articleChars}`,
    `- Tweets Count: ${review.tweetsCount}`,
    '',
    '## Heuristic Review',
    `- ${review.terminologyNote}`,
    `- ${review.structureNote}`,
    `- ${review.extractionNote}`,
    ''
  ];

  if (review.errorState) {
    lines.push('## Error Details');
    lines.push(`> ${review.errorState}`);
    lines.push('');
  }

  lines.push('## Evidence Paths');
  lines.push(`- Run Dir: ${runDir}`);
  lines.push(`- Evidence Pack: ${evidencePath}`);

  if (llmReview) {
    lines.push('');
    lines.push('## LLM Review');
    lines.push(`- Provider: ${llmReview.provider}`);
    lines.push(`- Model: ${llmReview.modelId}`);
    lines.push(`- Review Level (LLM): ${llmReview.reviewLevel}`);
    lines.push(`- Feasibility: ${llmReview.feasibility}`);
    lines.push(`- Confidence: ${llmReview.confidence}`);
    lines.push(`- Summary: ${llmReview.summary}`);
    lines.push(`- Risks: ${llmReview.risks.length ? llmReview.risks.join(' | ') : 'N/A'}`);
    lines.push(`- Recommendations: ${llmReview.recommendations.length ? llmReview.recommendations.join(' | ') : 'N/A'}`);
  }

  return lines.join('\n');
}

function buildDiscordMessage({ runDir, evidencePath, evidence, review, channelId, llmReview }) {
  const runId = evidence?.runId || 'N/A';
  const sourceUrl = evidence?.sourceUrl || 'N/A';

  const lines = [
    `📌 Daily Runner Report (Channel: #script-snap-exec / ${channelId})`,
    `- 执行状态: ${review.statusLabel}`,
    `- Run ID: ${runId}`,
    `- URL: ${sourceUrl}`,
    `- Duration: ${formatDuration(review.durationMs)}`,
    `- 内容指标: Article ${review.articleChars} chars / Tweets ${review.tweetsCount}`,
    `- 审核结论: ${review.finalReviewLevel || review.reviewLevel}`,
    `- Evidence Pack Path: ${evidencePath || 'N/A'}`,
    `- Review Summary Path: ${runDir ? path.join(runDir, 'review-summary.md') : 'N/A'}`
  ];

  if (llmReview) {
    lines.push(`- LLM: ${llmReview.modelId} / ${llmReview.feasibility} / ${llmReview.confidence}`);
  } else {
    lines.push('- LLM: unavailable (fallback to heuristic only)');
  }

  if (review.errorState) {
    lines.push(`- Error: ${review.errorState}`);
  }

  return lines.join('\n');
}

async function postDiscord(content, webhookUrl) {
  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Discord webhook failed (${response.status}): ${body}`);
  }
}

function postViaOpenClaw(content, channelId, dryRun) {
  const args = [
    'message',
    'send',
    '--channel',
    'discord',
    '--target',
    channelId,
    '--message',
    content
  ];

  if (dryRun) {
    args.push('--dry-run');
  }

  const result = spawnSync('openclaw', args, {
    encoding: 'utf-8'
  });

  if (result.error) {
    throw new Error(`Failed to execute openclaw: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`openclaw message send failed (${result.status}): ${result.stderr || result.stdout}`);
  }

  if (result.stdout) {
    console.log(`[REPORT] OpenClaw output:\n${result.stdout.trim()}`);
  }
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('run-dir', {
      type: 'string',
      description: 'Absolute run directory path'
    })
    .option('project-dir', {
      type: 'string',
      description: 'Project directory root',
      default: path.join(__dirname, '..')
    })
    .option('dry-run', {
      type: 'boolean',
      description: 'Generate review and print payload without posting to Discord',
      default: false
    })
    .option('transport', {
      type: 'string',
      choices: ['auto', 'openclaw', 'webhook'],
      description: 'Message transport. auto: openclaw first, then webhook fallback',
      default: 'auto'
    })
    .option('channel-id', {
      type: 'string',
      description: 'Discord channel id for OpenClaw transport',
      default: process.env.DISCORD_SCRIPT_SNAP_EXEC_CHANNEL_ID || DEFAULT_CHANNEL_ID
    })
    .option('llm-review', {
      type: 'boolean',
      description: 'Enable model-based review via OpenClaw agent',
      default: true
    })
    .option('llm-agent', {
      type: 'string',
      description: 'OpenClaw agent id used for model review',
      default: process.env.OPENCLAW_REVIEW_AGENT_ID || 'main'
    })
    .option('llm-session-id', {
      type: 'string',
      description: 'Explicit OpenClaw session id for model review'
    })
    .option('llm-timeout-sec', {
      type: 'number',
      description: 'Timeout in seconds for LLM review call',
      default: 120
    })
    .option('llm-max-input-chars', {
      type: 'number',
      description: 'Max chars per content excerpt sent to LLM',
      default: 6000
    })
    .parse();

  const projectDir = path.resolve(argv.projectDir);
  const latestMetaResult = readLatestMeta(projectDir);
  const latestMeta = latestMetaResult?.meta || null;
  const runDir = argv.runDir
    ? path.resolve(argv.runDir)
    : (latestMeta?.runDir ? path.resolve(latestMeta.runDir) : safeResolveRunDir(projectDir));

  let evidence = null;
  let evidencePath = null;
  let review = null;
  let llmReview = null;
  let reviewSummaryPath = null;

  if (runDir && fs.existsSync(path.join(runDir, 'evidence-pack.json'))) {
    const loaded = readEvidencePack(runDir);
    evidencePath = loaded.evidencePath;
    evidence = loaded.evidence;
    review = computeReview(evidence);
    if (argv.llmReview) {
      try {
        llmReview = runLlmReviewWithOpenClaw({
          evidence,
          heuristic: review,
          llmAgent: argv.llmAgent,
          llmSessionId: argv.llmSessionId,
          llmTimeoutSec: argv.llmTimeoutSec,
          maxInputChars: argv.llmMaxInputChars
        });
      } catch (error) {
        console.warn(`[REPORT] LLM review failed; fallback to heuristic only: ${error.message}`);
      }
    }
    review.finalReviewLevel = llmReview
      ? stricterReviewLevel(review.reviewLevel, llmReview.reviewLevel)
      : review.reviewLevel;

    const reviewMarkdown = buildReviewSummaryMarkdown({ runDir, evidencePath, evidence, review, llmReview });
    reviewSummaryPath = path.join(runDir, 'review-summary.md');
    fs.writeFileSync(reviewSummaryPath, reviewMarkdown, 'utf-8');
    console.log(`[REPORT] review-summary saved: ${reviewSummaryPath}`);
  } else {
    review = computeFallbackReview(latestMeta || {});
    review.finalReviewLevel = review.reviewLevel;
    evidence = {
      runId: latestMeta?.runId || 'N/A',
      sourceUrl: latestMeta?.sourceUrl || 'N/A'
    };
    console.warn('[REPORT] No evidence-pack.json found for latest run; sending fallback report.');
  }

  const channelId = argv.channelId;
  const message = buildDiscordMessage({ runDir, evidencePath, evidence, review, channelId, llmReview });
  console.log(`[REPORT] message payload:\n${message}`);

  const webhookUrl = process.env.DISCORD_SCRIPT_SNAP_EXEC_WEBHOOK_URL;
  if (argv.transport === 'openclaw' || argv.transport === 'auto') {
    try {
      postViaOpenClaw(message, channelId, argv.dryRun);
      if (argv.dryRun) {
        console.log('[REPORT] Dry-run mode: OpenClaw payload generated, no real send.');
      } else {
        console.log('[REPORT] Discord notification sent via OpenClaw.');
      }
      return;
    } catch (error) {
      if (argv.transport === 'openclaw') {
        throw error;
      }
      console.warn(`[REPORT] OpenClaw transport failed, fallback to webhook: ${error.message}`);
    }
  }

  if (argv.dryRun) {
    console.log('[REPORT] Dry-run mode: webhook send skipped.');
    return;
  }

  if (argv.transport === 'webhook' || argv.transport === 'auto') {
    if (!webhookUrl) {
      console.warn('[REPORT] DISCORD_SCRIPT_SNAP_EXEC_WEBHOOK_URL is not set; skipping webhook transport.');
      return;
    }

    await postDiscord(message, webhookUrl);
    console.log('[REPORT] Discord notification sent via webhook.');
    return;
  }
}

main().catch((error) => {
  console.error(`[REPORT] Post-run reporting failed: ${error.message}`);
  process.exitCode = 1;
});
