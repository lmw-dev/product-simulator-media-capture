const selectors = require('../config/selectors');
const config = require('../config/app-config');
const logger = require('../core/logger');

async function submitUrl(page, targetUrl) {
  logger.info(`Submitting target URL: ${targetUrl}`);

  // 1. Click "+ New Analysis" button on dashboard
  const newAnalysisBtn = page.locator(selectors.newAnalysisButton).filter({ visible: true }).first();
  await newAnalysisBtn.waitFor({ state: 'visible', timeout: config.timeout.selectorWait });
  await newAnalysisBtn.click();
  logger.info('Clicked New Analysis button. Waiting for modal...');

  // 2. Fill URL input in modal (input#url)
  const inputEl = page.locator(selectors.inputUrlField).filter({ visible: true }).first();
  await inputEl.waitFor({ state: 'visible', timeout: config.timeout.selectorWait });
  await inputEl.fill(targetUrl);
  logger.info(`URL filled: ${targetUrl}`);

  // 3. Click "Analyze" button to submit
  const submitBtn = page.locator(selectors.submitAnalysisBtn).filter({ visible: true }).first();
  await submitBtn.waitFor({ state: 'visible', timeout: config.timeout.selectorWait });
  await submitBtn.click();
  logger.info('Analyze submitted. Waiting for page transition...');

  // 4. Wait briefly for page to start transitioning
  await page.waitForTimeout(2000);

  const currentUrl = page.url();
  logger.info(`Post-submit URL: ${currentUrl}`);
}

module.exports = submitUrl;
