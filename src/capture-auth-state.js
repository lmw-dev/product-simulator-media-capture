/**
 * capture-auth-state.js
 *
 * 【一次性 Setup 工具】为自动化创建专用 Chrome profile 并完成登录。
 *
 * 为什么需要专用 profile？
 *   - Playwright 需要一个独立 Chrome profile（不是你平时用的那个，避免冲突）
 *   - 这个 profile 内已登录 Google + Script Snap
 *   - 每天的自动化 runner 直接启动这个 profile，复用已有登录态
 *   - session 有效期几个月，到期了再跑一次这个脚本就行
 *
 * 使用场景：
 *   - 首次 setup
 *   - Clerk session 过期后重新登录（几个月一次）
 *
 * 使用方法：
 *   node src/capture-auth-state.js
 *   npm run auth:capture
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const config = require('./config/app-config');

const profilePath = path.join(config.chromeUserDataDir, config.chromeProfileDir);

function waitForEnter(prompt) {
  if (prompt) process.stdout.write(prompt);
  return new Promise((resolve) => {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', () => resolve());
  });
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('  🔧 Script Snap 自动化 — Auth Setup 工具');
  console.log('='.repeat(60));
  console.log('');
  console.log('  此工具将创建/刷新专用 Chrome profile 的登录态。');
  console.log('  完成后，每日自动化 runner 无需任何人工干预。');
  console.log('');
  console.log(`  专用 profile 路径: ${profilePath}`);
  console.log('');

  // 检查 profile 是否已存在
  const profileExists = fs.existsSync(profilePath);
  if (profileExists) {
    console.log('  ℹ️  已有专用 profile，将在其中刷新登录态。');
  } else {
    console.log('  ℹ️  将创建新的专用 profile。');
  }

  console.log('');
  console.log('  ⚠️  重要：Chrome 将以有头模式打开。');
  console.log('     请在弹出的窗口中完成 Script Snap 登录。');
  console.log('     完成后回到这里按 ENTER。');
  console.log('='.repeat(60) + '\n');

  await waitForEnter('准备好了就按 ENTER 开始...\n');

  console.log('\n[auth:capture] 正在启动专用 Chrome profile...');

  // 使用 launchPersistentContext — Playwright 使用指定 profile 目录
  // 关键：headless: false，Google OAuth 需要真实浏览器窗口
  const context = await chromium.launchPersistentContext(profilePath, {
    executablePath: config.chromeExecutablePath,
    headless: false,
    viewport: { width: 1440, height: 900 },
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled', // 不让网站检测到自动化
    ],
    ignoreDefaultArgs: ['--enable-automation'], // 去掉 Playwright 默认的自动化标志
  });

  const page = await context.newPage();

  console.log(`[auth:capture] 正在打开: ${config.dashboardUrl}`);
  await page.goto(config.dashboardUrl, {
    waitUntil: 'domcontentloaded',
    timeout: config.timeout.pageLoad,
  });

  console.log('\n' + '='.repeat(60));
  console.log('  📋 现在请在弹出的 Chrome 窗口中：');
  console.log('');
  console.log('  1. 用 Google 或 GitHub 账号登录 Script Snap');
  console.log('  2. 确认看到 Dashboard 页面');
  console.log(`     （URL: script-snap.com/dashboard）`);
  console.log('  3. 回到此终端按 ENTER');
  console.log('='.repeat(60) + '\n');

  await waitForEnter('确认已看到 Dashboard 后按 ENTER...');

  const currentUrl = page.url();
  const isOnDashboard = currentUrl.includes('script-snap.com') &&
    !currentUrl.includes('sign-in') &&
    !currentUrl.includes('sign-up');

  if (!isOnDashboard) {
    console.error(`\n[auth:capture] ❌ 当前 URL 不是 Dashboard: ${currentUrl}`);
    console.error(`[auth:capture]    请确认已完成登录并看到 Dashboard，再按 ENTER。`);
    await context.close();
    process.exit(1);
  }

  console.log(`[auth:capture] ✅ 确认在 Dashboard: ${currentUrl}`);
  console.log('[auth:capture] Profile 已保存（登录态存在 profile 目录中）。');

  await context.close();

  console.log('\n' + '='.repeat(60));
  console.log('  ✅ Setup 完成！');
  console.log('');
  console.log('  现在可以运行分析（也可以设置定时任务）：');
  console.log('  node src/run-single-analysis.js --url "<YouTube URL>"');
  console.log('');
  console.log('  下次需要重新 setup（session 过期）时：');
  console.log('  node src/capture-auth-state.js');
  console.log('='.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('[auth:capture] Fatal error:', err.message);
  process.exit(1);
});
