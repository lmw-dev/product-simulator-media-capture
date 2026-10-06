const selectors = require('../config/selectors');
const config = require('../config/app-config');
const logger = require('./logger');

class ResultStateManager {
  /**
   * Determine the state of the analysis page.
   * @param {import('playwright').Page} page
   * @returns {Promise<'success' | 'timeout' | 'error' | 'blank' | 'loading_stuck'>}
   */
  async determineState(page) {
    logger.info('Waiting for analysis result state...');
    
    // We will race several conditions
    const successPromise = page.waitForSelector(selectors.resultSuccessIndicator, { timeout: config.timeout.analysisCompletion, state: 'visible' })
      .then(() => 'success').catch(() => null);
      
    const errorPromise = page.waitForSelector(selectors.resultErrorIndicator, { timeout: config.timeout.analysisCompletion, state: 'visible' })
      .then(() => 'error').catch(() => null);

    const result = await Promise.race([successPromise, errorPromise]);
    
    if (result) {
      if (result === 'success') {
        logger.info('Result state determined: success');
      } else {
        logger.error('Result state determined: error');
      }
      return result;
    }

    logger.warn('Analysis did not finish cleanly within timeout.');

    // === DIAGNOSTIC: capture page state at timeout ===
    let diagnosticHtml = '';
    let diagnosticText = '';
    try {
      diagnosticHtml = await page.content();
      diagnosticText = await page.evaluate(() => document.body?.innerText || '').catch(() => '');
      logger.warn(`[DIAGNOSTIC] Page HTML length: ${diagnosticHtml.length}`);
      logger.warn(`[DIAGNOSTIC] Page text (first 2000 chars): ${diagnosticText.slice(0, 2000)}`);
      // Log visible tab buttons to check if Article/Tweets tabs exist but are hidden
      const tabInfo = await page.evaluate(() => {
        const tabs = Array.from(document.querySelectorAll('button[role="tab"]'));
        return tabs.map(t => ({ text: t.textContent?.trim(), visible: t.offsetParent !== null, state: t.getAttribute('data-state') }));
      }).catch(() => []);
      logger.warn(`[DIAGNOSTIC] Tab buttons found: ${JSON.stringify(tabInfo)}`);
    } catch (diagErr) {
      logger.warn(`[DIAGNOSTIC] Failed to capture page state: ${diagErr.message}`);
    }

    // === FALLBACK: check for alternative success signals ===
    try {
      const fallbackResult = await page.evaluate(() => {
        const body = document.body?.innerText || '';
        // Check for common completion text patterns
        const completionPatterns = [/analysis complete/i, /completed successfully/i, /results are ready/i, /processing complete/i];
        for (const pat of completionPatterns) {
          if (pat.test(body)) return { matched: true, pattern: pat.source };
        }
        // Check if there are any visible elements with analysis-result in class/id
        const resultEl = document.querySelector('[class*="result"], [id*="result"], [data-testid*="result"]');
        if (resultEl && resultEl.offsetParent !== null) {
          return { matched: true, element: resultEl.tagName + '.' + resultEl.className };
        }
        return { matched: false };
      }).catch(() => ({ matched: false }));

      if (fallbackResult.matched) {
        logger.info(`[FALLBACK] Alternative success signal detected: ${JSON.stringify(fallbackResult)}`);
        return 'success';
      }
    } catch (fbErr) {
      logger.warn(`[FALLBACK] Check failed: ${fbErr.message}`);
    }

    // If both failed or timed out, let's see if we are still loading
    try {
      const isLoading = await page.isVisible(selectors.resultLoadingIndicator);
      if (isLoading) {
        logger.warn('Result state determined: loading_stuck');
        return 'loading_stuck';
      }
    } catch (e) {}

    // Check if it's mostly blank
    try {
      const content = diagnosticHtml || await page.content();
      if (!content || content.length < 1000) { // Arbitrary length for empty-ish body
         logger.warn('Result state determined: blank');
         return 'blank';
      }
    } catch(e) {}
    
    logger.warn('Result state determined: timeout');
    return 'timeout';
  }
}

module.exports = new ResultStateManager();
