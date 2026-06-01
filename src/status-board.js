/**
 * status-board.js
 *
 * Simulator 状态板模块。
 * 读取 quality-history.json + latest-run-meta.json + url_pool.db + auth state，
 * 输出结构化状态卡片。
 *
 * 用法:
 *   node src/status-board.js [--json] [--project-dir <path>]
 *
 * 输出:
 *   - 控制台可读状态卡片
 *   --json 模式输出结构化 JSON（供外部集成）
 */

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
// 数据库直接查询

const PROJECT_DIR_DEFAULT = path.join(__dirname, '..');

// ─── 数据读取 ──────────────────────────────────────────────────

function readLatestMeta(projectDir) {
  const metaPath = path.join(projectDir, 'outputs', 'latest-run-meta.json');
  if (!fs.existsSync(metaPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  } catch {
    return null;
  }
}

function readQualityHistory(projectDir) {
  const historyPath = path.join(projectDir, 'data', 'quality-history.json');
  if (!fs.existsSync(historyPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
  } catch {
    return [];
  }
}

function readPoolStats(projectDir) {
  // 优先读 config 中的路径，回退到已知文件名
  const configPath = path.join(projectDir, 'data', 'url-source-pool.sqlite');
  const fallbackPath = path.join(projectDir, 'data', 'url_pool.db');
  const dbPath = fs.existsSync(configPath) ? configPath : (fs.existsSync(fallbackPath) ? fallbackPath : null);
  if (!dbPath) return null;
  try {
    // 直接用 SQL 查询各状态计数
    const Database = require('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const row = db.prepare(`
      SELECT
        COUNT(*) as total,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'processed' THEN 1 ELSE 0 END) as processed,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
        SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped
      FROM source_urls
    `).get();
    db.close();
    return row;
  } catch {
    return null;
  }
}

function readAuthStatus(projectDir) {
  const statePath = path.join(projectDir, 'playwright', '.auth', 'state.json');
  if (!fs.existsSync(statePath)) return { valid: false, reason: 'no state file' };
  try {
    const state = JSON.parse(fs.readFileSync(statePath, 'utf-8'));
    const cookies = state.cookies || [];
    // 找 Script Snap 相关 cookie 中最早的过期时间
    const now = Date.now();
    let earliestExpiry = Infinity;
    let relevantCount = 0;
    for (const c of cookies) {
      if (c.name === '__session' || c.name === '__client' || c.name === '__client_uat') {
        relevantCount++;
        if (c.expires && c.expires > 0 && c.expires < earliestExpiry) {
          earliestExpiry = c.expires;
        }
      }
    }
    if (relevantCount === 0) return { valid: false, reason: 'no auth cookies found' };
    const daysLeft = Math.floor((earliestExpiry * 1000 - now) / (1000 * 60 * 60 * 24));
    return {
      valid: daysLeft > 7,
      daysLeft,
      cookieCount: cookies.length,
      relevantCookieCount: relevantCount,
    };
  } catch {
    return { valid: false, reason: 'read error' };
  }
}

// ─── 趋势分析 ──────────────────────────────────────────────────

function computeTrend(history, count = 3) {
  const recent = history.slice(-count);
  if (recent.length === 0) return { scores: [], direction: 'unknown' };
  const scores = recent.map(h => h.overallScore);
  const labels = recent.map(h => h.overallLabel);
  let direction = 'flat';
  if (scores.length >= 2) {
    const diff = scores[scores.length - 1] - scores[0];
    if (diff > 0.3) direction = 'up';
    else if (diff < -0.3) direction = 'down';
  }
  return { scores, labels, direction };
}

// ─── 状态卡片生成 ──────────────────────────────────────────────

function buildStatusCard(projectDir) {
  const meta = readLatestMeta(projectDir);
  const history = readQualityHistory(projectDir);
  const poolStats = readPoolStats(projectDir);
  const auth = readAuthStatus(projectDir);
  const trend = computeTrend(history, 3);

  // 最近跑测
  const lastRun = meta ? {
    runId: meta.runId,
    status: meta.status,
    sourceUrl: meta.sourceUrl,
    durationMs: meta.durationMs,
    finishedAt: meta.finishedAt,
    ageHours: Math.floor((Date.now() - new Date(meta.finishedAt).getTime()) / (1000 * 60 * 60)),
  } : null;

  // 质检趋势
  const qualityTrend = trend.scores.length > 0
    ? trend.scores.map((s, i) => `${s} (${trend.labels[i]})`).join(' → ')
    : '无数据';
  const trendEmoji = trend.direction === 'up' ? '📈' : trend.direction === 'down' ? '📉' : '➡️';

  // 状态总览
  const isHealthy = lastRun && lastRun.status === 'success' && auth.valid;
  const healthEmoji = isHealthy ? '🟢' : '🟡';

  return {
    // 结构化数据（供 JSON 输出）
    structured: {
      health: isHealthy ? 'healthy' : 'degraded',
      lastRun,
      qualityTrend: { scores: trend.scores, labels: trend.labels, direction: trend.direction },
      pool: poolStats,
      auth,
      generatedAt: new Date().toISOString(),
    },
    // 可读文本卡片
    text: [
      `${healthEmoji} Simulator V2 状态板`,
      ``,
      `⏰ 最近跑测: ${lastRun ? `${lastRun.finishedAt} (${lastRun.ageHours}h 前)` : '无记录'}`,
      `   状态: ${lastRun ? lastRun.status : 'N/A'} | RunID: ${lastRun ? lastRun.runId : 'N/A'}`,
      `   来源: ${lastRun ? lastRun.sourceUrl : 'N/A'}`,
      `   耗时: ${lastRun ? Math.round(lastRun.durationMs / 1000) + 's' : 'N/A'}`,
      ``,
      `${trendEmoji} 质检趋势 (最近${trend.scores.length}轮): ${qualityTrend}`,
      ``,
      `🔗 URL Pool: ${poolStats ? `总计 ${poolStats.total || 0} | 待消费 ${poolStats.pending || 0} | 已处理 ${poolStats.processed || 0} | 失败 ${poolStats.failed || 0}` : '数据库不可用'}`,
      ``,
      `🔐 Auth Token: ${auth.valid ? `✅ 有效 (${auth.daysLeft} 天后过期)` : `⚠️ 需刷新 (${auth.reason || '过期'})`}`,
      ``,
      `📅 Cron: 每日 09:00 / 14:00 / 19:00 (Asia/Shanghai)`,
      ``,
      `生成时间: ${new Date().toISOString()}`,
    ].join('\n'),
  };
}

// ─── 主流程 ────────────────────────────────────────────────────

function main() {
  const argv = yargs(hideBin(process.argv))
    .option('project-dir', { type: 'string', default: PROJECT_DIR_DEFAULT })
    .option('json', { type: 'boolean', default: false, describe: 'Output structured JSON' })
    .parse();

  const projectDir = path.resolve(argv.projectDir);
  const card = buildStatusCard(projectDir);

  if (argv.json) {
    console.log(JSON.stringify(card.structured, null, 2));
  } else {
    console.log(card.text);
  }

  // 同时写入 data/status-board-latest.json 供外部读取
  const outputPath = path.join(projectDir, 'data', 'status-board-latest.json');
  try {
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(card.structured, null, 2), 'utf-8');
    console.log(`\n[STATUS] JSON saved to: ${outputPath}`);
  } catch (e) {
    console.warn(`[STATUS] Failed to save JSON: ${e.message}`);
  }
}

main();
