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
    const newAnalysisBtn = await page.waitForSelector(selectors.newAnalysisButton, { timeout: config.timeout.selectorWait, state: 'visible' });
    await newAnalysisBtn.click();
    logger.info('Opened New Analysis Modal.');

    // 2. 在 Modal 中填入 URL
    const inputEl = await page.waitForSelector(selectors.inputUrlField, { timeout: config.timeout.selectorWait, state: 'visible' });
    await inputEl.fill(targetUrl);
    
    // 3. 点击 Analyze
    const submitBtn = await page.waitForSelector(selectors.submitAnalysisBtn, { timeout: config.timeout.selectorWait, state: 'visible' });
    await submitBtn.click();

    
    logger.info('URL submitted. Waiting for transition...');
  } catch (err) {
    logger.error(`Failed to submit URL: ${err.message}`);
    throw err;
  }
}

module.exports = submitUrl;
