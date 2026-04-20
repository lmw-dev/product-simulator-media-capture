const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
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
  const prompt = buildVniPrompt(evidence);
  const args = ['agent', '--agent', 'hermes', '--message', prompt, '--timeout', String(timeout), '--thinking', 'low'];
  console.log('[VNI] Calling Hermes for soul injection...');
  const result = spawnSync('openclaw', args, { encoding: 'utf-8' });
  if (result.status !== 0) throw new Error(`Hermes VNI failed: ${result.stderr || result.stdout}`);
  
  // Basic extraction from OpenClaw output
  try {
    const out = JSON.parse(result.stdout);
    return out.reply || out.content || out.text || result.stdout;
  } catch (e) {
    return result.stdout;
  }
}

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('project-dir', { type: 'string', default: path.join(__dirname, '..') })
    .option('channel-id', { type: 'string', default: DEFAULT_CHANNEL_ID })
    .option('vni', { type: 'boolean', default: true })
    .parse();

  const projectDir = path.resolve(argv.projectDir);
  const runDir = safeResolveRunDir(projectDir);
  if (!runDir) return console.error('No run directory found.');

  const { evidencePath, evidence } = readEvidencePack(runDir);
  const review = computeReview(evidence);

  let vniOutput = null;
  if (argv.vni && evidence.status === 'success') {
    try {
      vniOutput = runHermesVni(evidence, 180);
      const vniPath = path.join(runDir, 'hermes-vni-refinement.md');
      fs.writeFileSync(vniPath, vniOutput, 'utf-8');
      console.log(`[VNI] Results saved to ${vniPath}`);
    } catch (e) {
      console.warn(`[VNI] Failed: ${e.message}`);
    }
  }

  let msg = `📌 Daily Runner Report\n- 执行状态: ${review.statusLabel}\n- Run ID: ${evidence.runId}\n- 审核结论: ${review.reviewLevel}`;
  if (vniOutput) {
    msg += `\n\n🚀 [Hermes VNI Active] 灵魂注入成功！\n${vniOutput.substring(0, 500)}...`;
  }

  spawnSync('openclaw', ['message', 'send', '--channel', 'discord', '--target', argv.channel_id || DEFAULT_CHANNEL_ID, '--message', msg]);
  console.log('[REPORT] Dispatched to Discord.');
}

main().catch(e => { console.error(e); process.exit(1); });
