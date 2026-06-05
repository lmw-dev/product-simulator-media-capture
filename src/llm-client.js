/**
 * llm-client.js
 *
 * 多 Provider LLM 直连客户端。
 * 支持: Xiaomi (MiMo), DeepSeek, OpenAI, Gemini
 * 默认: Xiaomi
 *
 * 配置通过 .env 文件:
 *   LLM_PROVIDER=xiaomi|deepseek|openai|gemini
 *   LLM_BASE_URL=<api base url>
 *   LLM_API_KEY=<api key>
 *   LLM_MODEL=<model id>
 */

const https = require('https');
const http = require('http');
const { URL } = require('url');

// ─── .env 加载 ─────────────────────────────────────────────────

function loadEnv(envPath) {
  const fs = require('fs');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    // Strip inline comments (space + #) from value
    let val = trimmed.slice(eqIdx + 1);
    const commentIdx = val.indexOf(' #');
    if (commentIdx !== -1) val = val.slice(0, commentIdx);
    val = val.trim();
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

// ─── Provider 默认配置 ─────────────────────────────────────────

const PROVIDER_DEFAULTS = {
  xiaomi: {
    baseUrl: 'https://api.xiaomi.com/v1',
    model: 'MiMo-V2.5',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-2.5-flash',
  },
};

// ─── HTTP 请求 ─────────────────────────────────────────────────

function httpRequest(url, options, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;

    const req = transport.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 500)}`));
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(options.timeout || 120000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    if (body) req.write(body);
    req.end();
  });
}

// ─── OpenAI 兼容 API ───────────────────────────────────────────

async function callOpenAICompatible(baseUrl, apiKey, model, prompt, timeoutSeconds) {
  const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;
  const body = JSON.stringify({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: 4096,
  });

  const response = await httpRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    timeout: timeoutSeconds * 1000,
  }, body);

  const json = JSON.parse(response);
  return json.choices?.[0]?.message?.content || '';
}

// ─── Gemini API ────────────────────────────────────────────────

async function callGemini(baseUrl, apiKey, model, prompt, timeoutSeconds) {
  const url = `${baseUrl.replace(/\/+$/, '')}/models/${model}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 4096,
    },
  });

  const response = await httpRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeout: timeoutSeconds * 1000,
  }, body);

  const json = JSON.parse(response);
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

// ─── 主入口 ────────────────────────────────────────────────────

async function callLLM(prompt, timeoutSeconds = 120) {
  // 加载 .env（仅首次）
  if (!process.env._LLM_ENV_LOADED) {
    const envPath = require('path').join(__dirname, '..', '.env');
    loadEnv(envPath);
    process.env._LLM_ENV_LOADED = '1';
  }

  const provider = (process.env.LLM_PROVIDER || 'xiaomi').toLowerCase();
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) {
    throw new Error(`Unknown LLM provider: ${provider}. Supported: ${Object.keys(PROVIDER_DEFAULTS).join(', ')}`);
  }

  const baseUrl = process.env.LLM_BASE_URL || defaults.baseUrl;
  const apiKey = process.env.LLM_API_KEY;
  const model = process.env.LLM_MODEL || defaults.model;

  if (!apiKey) {
    throw new Error(`LLM_API_KEY not set for provider "${provider}". Check .env file.`);
  }

  console.log(`[LLM] Provider: ${provider} | Model: ${model} | Base: ${baseUrl}`);

  if (provider === 'gemini') {
    return callGemini(baseUrl, apiKey, model, prompt, timeoutSeconds);
  }

  // Xiaomi, DeepSeek, OpenAI 都走 OpenAI 兼容格式
  return callOpenAICompatible(baseUrl, apiKey, model, prompt, timeoutSeconds);
}

module.exports = { callLLM, loadEnv, PROVIDER_DEFAULTS };
