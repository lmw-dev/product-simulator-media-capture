#!/usr/bin/env node
/**
 * check-auth.js
 *
 * 【本地预检】检查 playwright/.auth/state.json 中的 cookie 是否在本地未过期。
 *
 * ⚠️  重要限制：
 *   这是纯本地文件检查，不发任何网络请求。
 *   即使本检查「通过」，Clerk 服务端 session 也可能已被 revoke（如换设备登录、手动登出、
 *   服务端策略刷新等）。最终有效性只有实际运行 runner 才能确认。
 *
 * 用途：快速排查「文件缺失」或「cookie 过期」这两种明显问题。
 *
 * 使用：
 *   node src/check-auth.js
 *   npm run auth:check
 *
 * 退出码：
 *   0 = 本地 cookie 未过期（不代表服务端 session 有效）
 *   1 = 文件不存在 / cookie 已在本地过期
 */

const fs = require('fs');
const path = require('path');
const config = require('./config/app-config');

const storageStatePath = config.storageStatePath;

console.log(`\n[auth:check] 检查 auth state...`);
console.log(`[auth:check] 路径: ${storageStatePath}\n`);

if (!fs.existsSync(storageStatePath)) {
  console.error(`[auth:check] ❌ 文件不存在`);
  console.error(`\n  请先运行: node src/capture-auth-state.js\n`);
  process.exit(1);
}

let state;
try {
  state = JSON.parse(fs.readFileSync(storageStatePath, 'utf-8'));
} catch (e) {
  console.error(`[auth:check] ❌ 文件解析失败: ${e.message}`);
  process.exit(1);
}

const now = Date.now() / 1000;
const cookies = state.cookies || [];

// Key cookies to check
const checks = [
  { name: '__session',      domain: 'script-snap.com', label: 'Script Snap Session' },
  { name: '__client',       domain: 'clerk.script-snap.com', label: 'Clerk Client Token' },
  { name: '__client_uat',   domain: 'script-snap.com', label: 'Clerk UAT' },
];

let allValid = true;

for (const check of checks) {
  const cookie = cookies.find(c => c.name === check.name && c.domain.includes(check.domain.split('.')[0]));
  if (!cookie) {
    console.log(`  ⚠️  ${check.label} (${check.name}): 未找到`);
    allValid = false;
    continue;
  }

  const expires = cookie.expires;
  if (expires === -1) {
    console.log(`  ✅  ${check.label} (${check.name}): Session cookie (no expiry)`);
    continue;
  }

  if (expires > now) {
    const daysLeft  = Math.floor((expires - now) / 86400);
    const hoursLeft = Math.floor(((expires - now) % 86400) / 3600);
    const expiryDate = new Date(expires * 1000).toLocaleDateString('zh-CN');
    console.log(`  ✅  ${check.label} (${check.name}): 有效，剩 ${daysLeft}天 ${hoursLeft}小时 (到期: ${expiryDate})`);
  } else {
    const expiredAgo = Math.floor((now - expires) / 3600);
    console.log(`  ❌  ${check.label} (${check.name}): 已过期 ${expiredAgo} 小时前`);
    allValid = false;
  }
}

// Check script-snap Clerk cookie count
const scriptSnapCookies = cookies.filter(c => c.domain.includes('script-snap'));
console.log(`\n[auth:check] Script Snap 相关 cookie 数量: ${scriptSnapCookies.length}`);

if (allValid) {
  const sessionCookie = cookies.find(c => c.name === '__session' && c.domain.includes('script-snap'));
  if (sessionCookie && sessionCookie.expires > now) {
    const daysLeft = Math.floor((sessionCookie.expires - now) / 86400);
    console.log(`\n[auth:check] ✅ 本地 cookie 未过期（剩约 ${daysLeft} 天）`);
    console.log(`[auth:check] ⚠️  注意：这只是本地文件检查，不验证服务端 session。`);
    console.log(`[auth:check]    如果 runner 仍被跳转到登录页，说明服务端 session 已被 revoke。`);
    console.log(`[auth:check]    解决方式：重新采集 auth state。`);
    console.log(`\n  重新采集（如 runner 报 AUTH REQUIRED）：`);
    console.log(`  node src/capture-auth-state.js`);
    console.log(`\n  运行分析（如确认 session 有效）：`);
    console.log(`  node src/run-single-analysis.js --url "<YouTube URL>"\n`);
  }
  process.exit(0);
} else {
  console.log(`\n[auth:check] ❌ 本地 cookie 已过期或文件不完整`);
  console.log(`[auth:check]    必须重新采集 auth state。`);
  console.log(`\n  重新采集：`);
  console.log(`  node src/capture-auth-state.js\n`);
  process.exit(1);
}
