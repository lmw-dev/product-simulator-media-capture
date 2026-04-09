const resultStateManager = require('../core/result-state');
const logger = require('../core/logger');

async function waitResultPage(page, packManager) {
  logger.info('Entering wait phase for result page...');
  
  packManager.updateStatus('running', 'waiting_for_result');
  
  const state = await resultStateManager.determineState(page);
  
  if (state === 'success') {
    packManager.updateStatus('success', 'result_page_reached');
    const screenshotPath = packManager.pathManager.getFilePath('result-page.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    packManager.addArtifact('resultPageScreenshot', screenshotPath);
    return true;
  } else {
    packManager.updateStatus(state, 'result_page_failed', `Failed to reach success state: ${state}`);
    const errScreenshotPath = packManager.pathManager.getFilePath('error-state-page.png');
    await page.screenshot({ path: errScreenshotPath, fullPage: true });
    packManager.addArtifact('resultPageScreenshot', errScreenshotPath);
    return false;
  }
}

module.exports = waitResultPage;
