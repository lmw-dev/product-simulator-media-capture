const selectors = require('../config/selectors');
const config = require('../config/app-config');
const logger = require('../core/logger');

async function captureArticle(page, packManager) {
  logger.info('Capturing Article panel...');
  try {
    // 1. Click Article tab to make it active
    const articleTab = page.locator(selectors.articleTab).first();
    await articleTab.waitFor({ state: 'visible', timeout: config.timeout.selectorWait });
    await articleTab.click();
    logger.info('Article tab clicked.');

    // 2. Wait for panel to become active
    const panel = page.locator(selectors.activeTabPanel).first();
    await panel.waitFor({ state: 'visible', timeout: config.timeout.selectorWait });

    // 3. Screenshot the full panel
    const screenshotPath = packManager.pathManager.getFilePath('article.png');
    await panel.screenshot({ path: screenshotPath });
    packManager.addArtifact('articleScreenshot', screenshotPath);
    logger.info(`Article screenshot saved: ${screenshotPath}`);

    // 4. Extract full text (innerText preserves heading / paragraph structure)
    const text = await panel.innerText();
    const cleaned = text.trim();

    if (cleaned.length > 0) {
      packManager.addContent('articleText', cleaned);
      logger.info(`Article text extracted (${cleaned.length} chars).`);
    } else {
      logger.warn('Article panel found but innerText is empty.');
      packManager.addContent('articleText', '');
    }

  } catch (err) {
    logger.error(`Failed to capture article: ${err.message}`);
    packManager.setObservation((packManager.pack.notes.observation || '') + ' Article capture failed.');
  }
}

module.exports = captureArticle;
