const selectors = require('../config/selectors');
const logger = require('../core/logger');

async function captureArticle(page, packManager) {
  logger.info('Capturing Article panel...');
  try {
    const articlePanel = await page.$(selectors.articlePanel);
    if (!articlePanel) {
      logger.warn('Article panel not found on the page.');
      packManager.setObservation((packManager.pack.notes.observation || '') + ' Article panel missing.');
      return;
    }

    const screenshotPath = packManager.pathManager.getFilePath('article.png');
    await articlePanel.screenshot({ path: screenshotPath });
    packManager.addArtifact('articleScreenshot', screenshotPath);

    const txtElement = await articlePanel.$(selectors.articleTextContent);
    if (txtElement) {
      const text = await txtElement.textContent();
      packManager.addContent('articleText', text);
      logger.info('Article content extracted.');
    } else {
      logger.warn('Article text content element not found inside panel.');
      packManager.addContent('articleText', ''); 
    }

  } catch (err) {
    logger.error('Failed to capture article:', err.message);
  }
}

module.exports = captureArticle;
