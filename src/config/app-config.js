const path = require('path');
const os = require('os');

const config = {
  dashboardUrl: process.env.SCRIPT_SNAP_DASHBOARD_URL || 'https://script-snap.com/dashboard',
  chromeExecutablePath: process.env.CHROME_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',

  // Chrome 专用 profile 目录（自动化运行时使用）
  // 默认使用专用 Bot profile，避免冲击用户日常使用的主 profile
  chromeUserDataDir: process.env.CHROME_USER_DATA_DIR ||
    path.join(os.homedir(), 'Library/Application Support/Google/Chrome'),
  chromeProfileDir: process.env.CHROME_PROFILE_DIR || 'ScriptSnapBot',

  // storageState 路径（保留作备用）
  storageStatePath: process.env.STORAGE_STATE_PATH ||
    path.join(__dirname, '../../playwright/.auth/state.json'),

  timeout: {
    pageLoad: 60000,
    analysisCompletion: 300000,
    selectorWait: 15000,
  },
  devMode: process.env.DEV_MODE === 'true'
};

module.exports = config;
