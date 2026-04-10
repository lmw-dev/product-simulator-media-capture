const selectors = require('../config/selectors');
const config = require('../config/app-config');
const resultStateManager = require('../core/result-state');
const logger = require('../core/logger');

async function waitResultPage(page, packManager) {
  logger.info('Entering wait phase for result page...');
  logger.info(`(Analysis can take up to ${config.timeout.analysisCompletion / 60000} minutes)`);
  packManager.updateStatus('running', 'waiting_for_result');

  // Log progress every 30 seconds so the operator knows the runner is alive
  const progressInterval = setInterval(() => {
    logger.info(`Still waiting... Current URL: ${page.url()}`);
  }, 30000);

  try {
    const state = await resultStateManager.determineState(page);

    if (state === 'success') {
      packManager.updateStatus('success', 'result_page_reached');
      const screenshotPath = packManager.pathManager.getFilePath('result-page.png');
      await page.screenshot({ path: screenshotPath, fullPage: true });
      packManager.addArtifact('resultPageScreenshot', screenshotPath);
      logger.info(`Result page screenshot saved: ${screenshotPath}`);
      return true;
    } else {
      packManager.updateStatus(state, 'result_page_failed', `Failed to reach success state: ${state}`);
      const errScreenshotPath = packManager.pathManager.getFilePath('error-state-page.png');
      await page.screenshot({ path: errScreenshotPath, fullPage: true });
      packManager.addArtifact('resultPageScreenshot', errScreenshotPath);
      return false;
    }
  } finally {
    clearInterval(progressInterval);
  }
}

module.exports = waitResultPage;
