module.exports = {
  // === Dashboard & Input Stage ===
  newAnalysisButton: 'button:has-text("New Analysis")', // 触发 Modal 的按钮
  inputUrlField: 'input[placeholder*="http"], input[placeholder*="URL"], input[type="url"], [role="dialog"] input', // Modal 里的 YouTube URL 输入框
  submitAnalysisBtn: 'button:has-text("Analyze"), [role="dialog"] button:has-text("Analyze")', // Modal 里的 Analyze 按钮

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
