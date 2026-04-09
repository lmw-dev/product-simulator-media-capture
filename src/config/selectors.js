module.exports = {
  // === Dashboard & Input Stage ===
  // 假设的新分析输入页
  inputUrlField: 'input[placeholder*="http"], input[name="url"], [data-testid="url-input"]',
  submitAnalysisBtn: 'button:has-text("Analyze"), button[type="submit"], [data-testid="submit-analysis-btn"]',

  // === Result Page Status Stage ===
  // 成功加载结果页的标志
  resultSuccessIndicator: '[data-testid="analysis-result-page"] h1, .result-header, .analysis-success',
  // 加载中状态
  resultLoadingIndicator: '.loading-spinner, .analyzing-state, [data-testid="analyzing-status"]',
  // 出错状态
  resultErrorIndicator: '.error-message, .analysis-failed, [data-testid="analysis-error"]',

  // === Detail Panels (Article & Tweets) Stage ===
  articlePanel: 'aside.article-panel, [data-testid="article-panel"], .article-container',
  articleTextContent: '.article-content-body, [data-testid="article-text"]',
  
  tweetsPanel: 'aside.tweets-panel, [data-testid="tweets-panel"], .tweets-container',
  tweetsTextContent: '.tweet-item, [data-testid="tweet-text"]'
};
