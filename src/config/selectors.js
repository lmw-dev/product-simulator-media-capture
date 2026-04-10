/**
 * selectors.js
 *
 * Script Snap UI 选择器配置。
 * 所有选择器均基于实际截图验证（2026-04-10）。
 * 如 UI 更新导致选择器失效，在此处修改，步骤代码无需改动。
 */

module.exports = {
  // === Dashboard 入口 ===
  // 右上角「+ New Analysis」按钮
  newAnalysisButton: 'button:has-text("New Analysis")',

  // === New Analysis Modal ===
  // Modal 标题: "New Analysis Project"
  // URL 输入框: input#url, placeholder = "https://www.youtube.com/watch?v=..."
  inputUrlField: 'input#url',
  // 提交按钮文字: "Analyze"
  submitAnalysisBtn: 'button:has-text("Analyze")',

  // === Result / Analysis 页面状态 ===
  // 分析处理中 URL pattern: /project/<id>
  // 分析完成后 URL 仍为 /project/<id>，页面换内容
  //
  // 成功标志: Article/Tweets tab 出现
  resultSuccessIndicator: [
    'button[role="tab"]:has-text("Article")',
    'button[role="tab"]:has-text("Tweets")',
    '[data-testid="analysis-result-page"]',
    '.result-header',
  ].join(', '),

  // 加载中标志: terminal 动画 / ASSET ANALYSIS PIPELINE 文字
  resultLoadingIndicator: [
    'pre',                          // terminal 输出容器
    '[class*="terminal"]',
    'text="ASSET ANALYSIS PIPELINE"',
    '[class*="loading"]',
  ].join(', '),

  // 出错标志
  resultErrorIndicator: [
    '.error-message',
    '[class*="error"]',
    '[class*="failed"]',
  ].join(', '),

  // === Detail Panels (Article & Tweets) ===
  // Tab 按钮: 文字匹配（ID 是动态的 radix ID）
  articleTab: 'button[role="tab"]:has-text("Article")',
  tweetsTab: 'button[role="tab"]:has-text("Tweets")',

  // Article 内容区域
  articlePanel: '[data-testid="article-panel"], [class*="article"], .prose',
  articleTextContent: '[class*="article"] p, .prose p, [role="tabpanel"] p',

  // Tweets 内容区域
  tweetsPanel: '[data-testid="tweets-panel"], [class*="tweet"]',
  tweetsTextContent: '[class*="tweet"] p, [role="tabpanel"][data-state="active"] p',
};
