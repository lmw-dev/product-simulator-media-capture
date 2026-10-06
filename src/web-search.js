/**
 * web-search.js
 *
 * 轻量级 Web 搜索模块，用于质检阶段的事实核查。
 * 使用 Google Gemini Search Grounding（复用 OpenClaw 的 Google API key）。
 *
 * 用法:
 *   const { factCheck, extractClaims } = require('./web-search');
 *   const context = await factCheck(articleText, tweetsText);
 */

const { execSync } = require('child_process');

// ─── .env + openclaw.json 加载 ─────────────────────────────────

function loadEnv() {
  if (process.env._WEB_SEARCH_ENV_LOADED) return;
  const fs = require('fs');

  // 1. 从 .env 加载
  const envPath = require('path').join(__dirname, '..', '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1);
      const commentIdx = val.indexOf(' #');
      if (commentIdx !== -1) val = val.slice(0, commentIdx);
      val = val.trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }

  // 2. 从 OpenClaw config 补充 Google API key
  if (!process.env.GOOGLE_SEARCH_API_KEY) {
    try {
      const os = require('os');
      const ocPath = require('path').join(os.homedir(), '.openclaw', 'openclaw.json');
      if (fs.existsSync(ocPath)) {
        const oc = JSON.parse(fs.readFileSync(ocPath, 'utf-8'));
        const key = oc?.plugins?.entries?.google?.config?.webSearch?.apiKey;
        if (key) {
          process.env.GOOGLE_SEARCH_API_KEY = key
          console.log('[WEB-SEARCH] Loaded Google API key from openclaw.json');
        }
      }
    } catch (e) {
      // ignore
    }
  }

  process.env._WEB_SEARCH_ENV_LOADED = '1';
}



// ─── Gemini Search Grounding ───────────────────────────────────

/**
 * 用 Gemini + Google Search 验证单个声明。
 * 返回 { confirmed: bool, answer: string, sources: string[] } | null
 */
async function geminiSearchVerify(claim) {
  loadEnv();
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  if (!apiKey) return null;

  const model = process.env.GOOGLE_SEARCH_MODEL || 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const body = JSON.stringify({
    contents: [{
      parts: [{
        text: `You are a fact-checker. Verify this claim from a tech article: "${claim}"

Rules:
- Search the web to verify if this claim is factually accurate as of 2026.
- Respond in this exact JSON format (no markdown fences):
{"confirmed": true/false, "answer": "brief factual summary", "sources": ["source1", "source2"]}
- If you cannot find evidence, set confirmed to false and explain why in the answer field.
- Be precise about numbers, dates, and model names.`
      }]
    }],
    tools: [{ googleSearch: {} }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 1024 },
  });

  try {
    const output = execSync(
      `curl -s --max-time 15 -H "Content-Type: application/json" -d '${body.replace(/'/g, "'\"'\"'")}' "${url}"`,
      { encoding: 'utf-8', timeout: 20000 }
    );

    const json = JSON.parse(output);
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // 提取 JSON
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch (e) {
        // ignore
      }
    }

    // 降级：返回原始文本
    return { confirmed: null, answer: text.slice(0, 200), sources: [] };
  } catch (e) {
    console.warn(`[WEB-SEARCH] Gemini verify failed for "${claim}": ${e.message}`);
    return null;
  }
}

// ─── 声明提取 ──────────────────────────────────────────────────

/**
 * 从 article + tweets 中提取需要验证的关键声明。
 */
function extractClaims(articleText, tweetsText) {
  const fullText = `${articleText}\n${tweetsText}`;
  const claims = [];

  // 1. 模型名 + 版本号
  const modelPatterns = [
    /\b(Claude|Opus|Sonnet|Haiku|GPT|ChatGPT|Gemini|DeepSeek|Cursor|Composer|Llama|Mistral|Qwen|MiMo)\s*[\d.]+\b/gi,
    /\b(o[1-9]|o[1-9][\d.]*)\b/gi,
  ];
  for (const pattern of modelPatterns) {
    const matches = fullText.match(pattern) || [];
    for (const m of matches) {
      const clean = m.trim();
      if (clean && !claims.some(c => c.query === clean)) {
        claims.push({ type: 'model', query: clean });
      }
    }
  }

  // 2. ARR / 融资金额（$XB, $XM）
  const moneyPattern = /\$[\d,.]+\s*[BMK](?:\s*ARR)?/gi;
  const moneyMatches = fullText.match(moneyPattern) || [];
  for (const m of moneyMatches) {
    const idx = fullText.indexOf(m);
    const context = fullText.slice(Math.max(0, idx - 100), idx + m.length + 20);
    const companyMatch = context.match(/\b(Anthropic|OpenAI|Google|Meta|Microsoft|DeepSeek|Cursor|Base10|OpenRouter|Uber)\b/i);
    const company = companyMatch ? companyMatch[1] : '';
    const query = company ? `${company} ${m} 2026` : m;
    if (!claims.some(c => c.query === query)) {
      claims.push({ type: 'financial', query, company });
    }
  }

  // 3. 公司 + 融资/估值
  const fundingPattern = /\b(Anthropic|OpenAI|Google|Meta|Microsoft|DeepSeek|Cursor|Base10|OpenRouter)\b[^.]*?\$[\d,.]+\s*[BMK]/gi;
  const fundingMatches = fullText.match(fundingPattern) || [];
  for (const m of fundingMatches) {
    const query = m.slice(0, 80).trim();
    if (!claims.some(c => c.query === query)) {
      claims.push({ type: 'funding', query });
    }
  }

  // 去重 + 限制数量
  const MAX_CLAIMS = 5;
  const unique = [];
  const seen = new Set();
  for (const c of claims) {
    const key = c.query.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(c);
    }
    if (unique.length >= MAX_CLAIMS) break;
  }

  return unique;
}

// ─── 主入口 ────────────────────────────────────────────────────

/**
 * 对提取的声明进行 Gemini search grounding 验证。
 * 返回格式化的验证上下文，可直接注入质检 prompt。
 */
async function verifyClaims(claims) {
  if (claims.length === 0) return '';

  loadEnv();
  if (!process.env.GOOGLE_SEARCH_API_KEY) {
    console.warn('[WEB-SEARCH] No GOOGLE_SEARCH_API_KEY configured, skipping verification.');
    return '';
  }

  console.log(`[WEB-SEARCH] Verifying ${claims.length} claims via Gemini Search...`);
  const results = [];

  for (const claim of claims) {
    console.log(`[WEB-SEARCH]   Checking: "${claim.query}"`);
    const result = await geminiSearchVerify(claim.query);
    if (result) {
      results.push({
        claim: claim.query,
        type: claim.type,
        confirmed: result.confirmed,
        answer: result.answer,
        sources: result.sources || [],
      });
    } else {
      results.push({
        claim: claim.query,
        type: claim.type,
        confirmed: null,
        answer: 'Verification unavailable',
        sources: [],
      });
    }
    // Rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  if (results.length === 0) return '';

  let context = '\n\n=== WEB SEARCH VERIFICATION CONTEXT ===\n';
  context += 'The following claims were verified via Google Search (Gemini grounding):\n\n';
  for (const r of results) {
    const status = r.confirmed === true ? 'CONFIRMED' : r.confirmed === false ? 'REFUTED' : 'UNVERIFIABLE';
    context += `CLAIM: "${r.claim}"\n`;
    context += `STATUS: ${status}\n`;
    context += `FACTUAL SUMMARY: ${r.answer}\n`;
    if (r.sources.length > 0) {
      context += `SOURCES: ${r.sources.join(', ')}\n`;
    }
    context += '\n';
  }
  context += '=== END VERIFICATION CONTEXT ===\n';
  return context;
}

// ─── 便捷组合函数 ──────────────────────────────────────────────

async function factCheck(articleText, tweetsText) {
  const claims = extractClaims(articleText, tweetsText);
  if (claims.length === 0) {
    console.log('[WEB-SEARCH] No verifiable claims extracted.');
    return '';
  }
  return verifyClaims(claims);
}

module.exports = { geminiSearchVerify, extractClaims, verifyClaims, factCheck };
