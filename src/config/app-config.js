const path = require('path');

const config = {
  dashboardUrl: process.env.SCRIPT_SNAP_DASHBOARD_URL || 'https://app.scriptsnap.ai/dashboard',
  newAnalysisUrl: process.env.SCRIPT_SNAP_NEW_ANALYSIS_URL || 'https://app.scriptsnap.ai/analyze/new',
  storageStatePath: process.env.STORAGE_STATE_PATH || path.join(__dirname, '../../playwright/.auth/state.json'),
  timeout: {
    pageLoad: 60000,
    analysisCompletion: 300000, // 5 mins fallback timeout for analysis
    selectorWait: 15000,
  },
  devMode: process.env.DEV_MODE === 'true' // if true, runs headless=false
};

module.exports = config;
