const selectors = require('../config/selectors');
const logger = require('../core/logger');

async function captureTweets(page, packManager) {
  logger.info('Capturing Tweets panel...');
  try {
    const tweetsPanel = await page.$(selectors.tweetsPanel);
    if (!tweetsPanel) {
      logger.warn('Tweets panel not found on the page.');
      packManager.setObservation((packManager.pack.notes.observation || '') + ' Tweets panel missing.');
      return;
    }

    const screenshotPath = packManager.pathManager.getFilePath('tweets.png');
    await tweetsPanel.screenshot({ path: screenshotPath });
    packManager.addArtifact('tweetsScreenshot', screenshotPath);

    const txtElements = await tweetsPanel.$$(selectors.tweetsTextContent);
    if (txtElements && txtElements.length > 0) {
      const textArr = await Promise.all(txtElements.map(el => el.textContent()));
      const fullText = textArr.map(t => t.trim()).filter(Boolean).join('\n---\n');
      packManager.addContent('tweetsText', fullText);
      logger.info(`Tweets content extracted (${txtElements.length} items).`);
    } else {
      logger.warn('Tweets text content elements not found inside panel.');
      packManager.addContent('tweetsText', ''); 
    }

  } catch (err) {
    logger.error('Failed to capture tweets:', err.message);
  }
}

module.exports = captureTweets;
