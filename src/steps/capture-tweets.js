const selectors = require('../config/selectors');
const config = require('../config/app-config');
const logger = require('../core/logger');

async function captureTweets(page, packManager) {
  logger.info('Capturing Tweets panel...');
  try {
    // 1. Click Tweets tab to make it active
    const tweetsTab = page.locator(selectors.tweetsTab).first();
    await tweetsTab.waitFor({ state: 'visible', timeout: config.timeout.selectorWait });
    await tweetsTab.click();
    logger.info('Tweets tab clicked.');

    // 2. Wait for panel to become active
    const panel = page.locator(selectors.activeTabPanel).first();
    await panel.waitFor({ state: 'visible', timeout: config.timeout.selectorWait });

    // 3. Screenshot the full tweets panel
    const screenshotPath = packManager.pathManager.getFilePath('tweets.png');
    await panel.screenshot({ path: screenshotPath });
    packManager.addArtifact('tweetsScreenshot', screenshotPath);
    logger.info(`Tweets screenshot saved: ${screenshotPath}`);

    // 4. Extract individual tweet texts
    // Each tweet card: [index circle] [p text] [Copy button]
    // We grab all <p> elements and filter out index numbers / button labels (< 10 chars)
    const pElements = panel.locator('p');
    const count = await pElements.count();
    logger.info(`Found ${count} <p> elements in Tweets panel.`);

    const tweetTexts = [];
    for (let i = 0; i < count; i++) {
      const text = (await pElements.nth(i).innerText()).trim();
      if (text.length > 10) {  // filter index numbers & empty / button text
        tweetTexts.push(text);
      }
    }

    if (tweetTexts.length > 0) {
      const fullText = tweetTexts
        .map((t, i) => `[Tweet ${i + 1}]\n${t}`)
        .join('\n---\n');
      packManager.addContent('tweetsText', fullText);
      logger.info(`Tweets extracted: ${tweetTexts.length} items.`);
    } else {
      logger.warn('No tweet text items found in panel.');
      packManager.addContent('tweetsText', '');
    }

  } catch (err) {
    logger.error(`Failed to capture tweets: ${err.message}`);
    packManager.setObservation((packManager.pack.notes.observation || '') + ' Tweets capture failed.');
  }
}

module.exports = captureTweets;
