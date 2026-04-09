const selectors = require('../config/selectors');
const config = require('../config/app-config');
const logger = require('../core/logger');

async function submitUrl(page, targetUrl) {
  logger.info(`Navigating to new analysis page / input page...`);
  
  if (page.url() !== config.newAnalysisUrl) {
    await page.goto(config.newAnalysisUrl, { waitUntil: 'domcontentloaded', timeout: config.timeout.pageLoad });
  }

  logger.info(`Submitting target URL: ${targetUrl}`);
  
  try {
    const inputEl = await page.waitForSelector(selectors.inputUrlField, { timeout: config.timeout.selectorWait, state: 'visible' });
    await inputEl.fill(targetUrl);
    
    const submitBtn = await page.waitForSelector(selectors.submitAnalysisBtn, { timeout: config.timeout.selectorWait, state: 'visible' });
    await submitBtn.click();
    
    logger.info('URL submitted. Waiting for transition...');
  } catch (err) {
    logger.error(`Failed to submit URL: ${err.message}`);
    throw err;
  }
}

module.exports = submitUrl;
