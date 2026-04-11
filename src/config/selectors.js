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
  // 两个面板共用同一个 tabpanel 容器 (Radix UI)
  // 区分方式：先点击 tab 按钮，再获取 data-state="active" 的 panel

  // Tab 切换按钮（文字匹配，Radix 的 ID 是动态的）
  articleTab: 'button[role="tab"]:has-text("Article")',
  tweetsTab: 'button[role="tab"]:has-text("Tweets")',

  // 活跃 tabpanel 容器（点击 tab 后使用）
  activeTabPanel: 'div[role="tabpanel"][data-state="active"]',

  // Article 内容：标准 Markdown HTML，提取全部文本内容
  // 策略：取整个 panel innerText（包含 h1/h2/p/li/table 等）
  articleTextContent: 'div[role="tabpanel"][data-state="active"]',

  // Tweets 内容：每条 tweet 是一个卡片
  // 结构： [Index圆圈] [p 正文] [Copy按钮]
  // 策略：取 panel 下所有 p 元素，过滤掉太短的（数字和按钮标签）
  tweetsTextContent: 'div[role="tabpanel"][data-state="active"] p',
};
