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
      const content = await page.content();
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
