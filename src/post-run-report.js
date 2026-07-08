const fs = require('fs');
const path = require('path');
const { spawn, spawnSync } = require('child_process');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const DEFAULT_CHANNEL_ID = '1489176810410479696';

function readLatestMeta(projectDir) {
  const metaPath = path.join(projectDir, 'outputs', 'latest-run-meta.json');
  if (!fs.existsSync(metaPath)) return null;
  try {
    return { metaPath, meta: JSON.parse(fs.readFileSync(metaPath, 'utf-8')) };
  } catch (error) {
    console.warn(`[REPORT] Failed to parse latest-run-meta.json: ${error.message}`);
    return null;
  }
}

function listRunDirectories(outputsDir) {
  if (!fs.existsSync(outputsDir)) return [];
  const dayDirs = fs.readdirSync(outputsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map(entry => entry.name).sort((a, b) => b.localeCompare(a));

  const runDirs = [];
  for (const dayDir of dayDirs) {
    const absDayDir = path.join(outputsDir, dayDir);
    const dayRuns = fs.readdirSync(absDayDir, { withFileTypes: true })
      .filter(entry => entry.isDirectory() && entry.name.startsWith('run-'))
      .map(entry => path.join(absDayDir, entry.name));
    runDirs.push(...dayRuns);
  }
  return runDirs.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function safeResolveRunDir(projectDir) {
  try {
    const outputsDir = path.join(projectDir, 'outputs');
    const runDirs = listRunDirectories(outputsDir);
    return runDirs.length > 0 ? runDirs[0] : null;
  } catch (_) { return null; }
}

function readEvidencePack(runDir) {
  const evidencePath = path.join(runDir, 'evidence-pack.json');
  if (!fs.existsSync(evidencePath)) throw new Error(`Missing evidence pack: ${evidencePath}`);
  return { evidencePath, evidence: JSON.parse(fs.readFileSync(evidencePath, 'utf-8')) };
}

function computeReview(evidence) {
  const status = evidence.status || 'unknown';
  const articleText = evidence.content?.articleText || '';
  const tweetsText = evidence.content?.tweetsText || '';
  const articleChars = articleText.length;
  const tweetsCount = (tweetsText.match(/\[Tweet\s+\d+\]/g) || []).length || tweetsText.split('\n---\n').filter(Boolean).length;

  let statusLabel = status === 'success' ? '✅ 成功' : (status === 'timeout' ? '⚠️ 超时' : '❌ 失败');
  return {
    statusLabel,
    reviewLevel: status === 'success' && articleChars > 120 ? 'Pass' : 'Fail',
    articleChars,
    tweetsCount,
    durationMs: evidence.runtime?.durationMs || null
  };
}

// ─── 质检集成 ──────────────────────────────────────────────────

function runQualityInspection(projectDir, runDir) {
  return new Promise((resolve) => {
    const inspectorPath = path.join(projectDir, 'src', 'quality-inspector.js');
    if (!fs.existsSync(inspectorPath)) {
      console.warn('[REPORT] quality-inspector.js not found, skipping inspection.');
      return resolve(null);
    }

    console.log('[REPORT] Running quality inspection...');
    const child = spawn('node', [inspectorPath, '--run-dir', runDir], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });

    const timer = setTimeout(() => { child.kill(); }, 180000); // 3 min timeout

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        console.warn(`[REPORT] Quality inspection failed (exit ${code}): ${stderr || stdout}`);
        return resolve(null);
      }

      const reportPath = path.join(runDir, 'quality-report.json');
      if (fs.existsSync(reportPath)) {
        try {
          resolve(JSON.parse(fs.readFileSync(reportPath, 'utf-8')));
        } catch (e) {
          console.warn(`[REPORT] Failed to parse quality report: ${e.message}`);
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      console.warn(`[REPORT] Quality inspection spawn error: ${err.message}`);
      resolve(null);
    });
  });
}

function readQualityHistory(projectDir) {
  const historyPath = path.join(projectDir, 'data', 'quality-history.json');
  if (!fs.existsSync(historyPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
  } catch (e) {
    return [];
  }
}

function formatQualitySection(qualityReport, history) {
  if (!qualityReport || !qualityReport.llmAvailable) {
    return '\n📊 质检: LLM 不可用（降级为基础统计）';
  }

  const score = qualityReport.overallScore;
  const label = qualityReport.overallLabel;
  const scoreEmoji = score >= 4 ? '🟢' : score >= 3 ? '🟡' : '🔴';

  let msg = `\n${scoreEmoji} 质检评分: ${score}/5 (${label})`;

  // 维度明细
  if (qualityReport.scores) {
    const dims = [];
    for (const [dim, val] of Object.entries(qualityReport.scores)) {
      const dimEmoji = val.score >= 4 ? '✓' : val.score >= 3 ? '~' : '✗';
      const dimName = {
        fidelity: '保真度',
        structure: '结构化',
        terminology: '术语识别',
        usability: '可用性',
        tweetQuality: '推文质量',
      }[dim] || dim;
      dims.push(`${dimEmoji} ${dimName}: ${val.score}`);
    }
    msg += `\n  ${dims.join(' | ')}`;
  }

  // 趋势对比
  if (history.length >= 2) {
    const prev = history[history.length - 2];
    const diff = (score - prev.overallScore).toFixed(1);
    if (diff > 0) msg += `\n📈 趋势: +${diff}（较上次提升）`;
    else if (diff < 0) msg += `\n📉 趋势: ${diff}（较上次下降）`;
    else msg += `\n➡️ 趋势: 持平`;
  }

  // 关键问题
  const criticals = (qualityReport.issues || []).filter(i => i.severity === 'critical');
  if (criticals.length > 0) {
    msg += `\n🚨 严重问题 (${criticals.length}):`;
    for (const issue of criticals.slice(0, 3)) {
      msg += `\n  • ${issue.description}`;
    }
  }

  // 优化建议（取前 2 条）
  if (qualityReport.suggestions && qualityReport.suggestions.length > 0) {
    msg += `\n💡 建议:`;
    for (const s of qualityReport.suggestions.slice(0, 2)) {
      msg += `\n  → ${s}`;
    }
  }

  return msg;
}

// ─── VNI (保留原有逻辑) ────────────────────────────────────────

function buildVniPrompt(evidence) {
  return `You are Hermes, a top Tech Influencer. 
Upgrade these raw tweets into "High-Quality Growth Assets".
Persona: Hardcore tech critic, sharp, technically deep, anti-AI fluff.

Raw Tweets:
${evidence.content.tweetsText}

Rules:
1. Hook first.
2. Technical depth (e.g. mention specific specs).
3. Builder-native language.
4. Output EXACTLY 4 upgraded tweets separated by "---". No intro/outro.`;
}

function runHermesVni(evidence, timeout) {
  return new Promise((resolve, reject) => {
    const prompt = buildVniPrompt(evidence);
    const args = ['agent', '--agent', 'main', '--message', prompt, '--timeout', String(timeout), '--thinking', 'low'];
    console.log('[VNI] Calling Hermes for soul injection...');
    const child = spawn('openclaw', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '', stderr = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });

    const timer = setTimeout(() => { child.kill(); }, timeout * 1000);

    child.on('close', (code) => {
      clearTimeout(timer);
      if (code !== 0) {
        return reject(new Error(`Hermes VNI failed (exit ${code}): ${stderr || stdout}`));
      }
      try {
        const out = JSON.parse(stdout);
        resolve(out.reply || out.content || out.text || stdout);
      } catch (e) {
        resolve(stdout);
      }
    });

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

// ─── 主流程 ────────────────────────────────────────────────────

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('project-dir', { type: 'string', default: path.join(__dirname, '..') })
    .option('channel-id', { type: 'string', default: DEFAULT_CHANNEL_ID })
    .option('vni', { type: 'boolean', default: true })
    .option('quality', { type: 'boolean', default: true, describe: 'Run quality inspection' })
    .parse();

  const projectDir = path.resolve(argv.projectDir);
  const runDir = safeResolveRunDir(projectDir);
  if (!runDir) return console.error('No run directory found.');

  const { evidencePath, evidence } = readEvidencePack(runDir);
  const review = computeReview(evidence);

  // 双通道并行：质检 + VNI 独立执行，互不阻塞
  let qualityReport = null;
  let vniOutput = null;

  const runQuality = async () => {
    if (argv.quality && evidence.status === 'success') {
      qualityReport = await runQualityInspection(projectDir, runDir);
    }
  };

  const runVni = async () => {
    if (argv.vni && evidence.status === 'success') {
      try {
        vniOutput = await runHermesVni(evidence, 180);
        const vniPath = path.join(runDir, 'hermes-vni-refinement.md');
        fs.writeFileSync(vniPath, vniOutput, 'utf-8');
        console.log(`[VNI] Results saved to ${vniPath}`);
      } catch (e) {
        console.warn(`[VNI] Failed: ${e.message}`);
      }
    }
  };

  // 并行启动两个通道
  const [qualityResult, vniResult] = await Promise.allSettled([runQuality(), runVni()]);
  if (qualityResult.status === 'rejected') console.warn(`[REPORT] Quality channel error: ${qualityResult.reason}`);
  if (vniResult.status === 'rejected') console.warn(`[REPORT] VNI channel error: ${vniResult.reason}`);

  // 构建报告
  const history = readQualityHistory(projectDir);
  let msg = `📌 Daily Runner Report`;
  msg += `\n- 执行状态: ${review.statusLabel}`;
  msg += `\n- Run ID: ${evidence.runId}`;
  msg += `\n- 审核结论: ${review.reviewLevel}`;
  msg += `\n- 文章: ${review.articleChars} 字符 | 推文: ${review.tweetsCount} 条`;
  if (review.durationMs) {
    msg += `\n- 耗时: ${Math.round(review.durationMs / 1000)}s`;
  }

  // 质检区块
  msg += formatQualitySection(qualityReport, history);

  // VNI 区块
  if (vniOutput) {
    msg += `\n\n🚀 [Hermes VNI] 灵魂注入成功\n${vniOutput.substring(0, 500)}...`;
  }

  const r = spawnSync('openclaw', ['message', 'send', '--channel', 'discord', '--target', argv.channelId || DEFAULT_CHANNEL_ID, '--message', msg], {encoding:'utf-8'}); 
  console.log(r.stdout || '');
  if (r.stderr) console.error(r.stderr);
  console.log('[REPORT] Dispatched to Discord.');
}

main().catch(e => { console.error(e); process.exit(1); });
