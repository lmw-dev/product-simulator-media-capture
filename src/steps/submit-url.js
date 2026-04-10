const selectors = require('../config/selectors');
const config = require('../config/app-config');
const logger = require('../core/logger');

async function submitUrl(page, targetUrl) {
  logger.info(`Navigating to new analysis page / input page...`);
  
  if (!page.url().includes('dashboard')) {
    await page.goto(config.dashboardUrl, { waitUntil: 'domcontentloaded', timeout: config.timeout.pageLoad });
  }

  logger.info(`Submitting target URL: ${targetUrl}`);
  
  try {
    // 1. 点击 Dashboard 上的 New Analysis 按钮调出 Modal
    // 我们尝试用一个更广宽泛覆盖的 locater 阵列
    const newAnalysisBtn = page.locator(selectors.newAnalysisButton).first();
    await newAnalysisBtn.waitFor({ state: 'visible', timeout: config.timeout.selectorWait });
    await newAnalysisBtn.click();
    logger.info('Opened New Analysis Modal.');

    // 2. 在 Modal 中填入 URL
    const inputEl = page.locator(selectors.inputUrlField).first();
    await inputEl.waitFor({ state: 'visible', timeout: config.timeout.selectorWait });
    await inputEl.fill(targetUrl);
    
    // 3. 点击 Analyze
    const submitBtn = page.locator(selectors.submitAnalysisBtn).first();
    await submitBtn.waitFor({ state: 'visible', timeout: config.timeout.selectorWait });
    await submitBtn.click();

    
    logger.info('URL submitted. Waiting for transition...');
  } catch (err) {
    logger.error(`Failed to submit URL: ${err.message}`);
    throw err;
  }
}

module.exports = submitUrl;
