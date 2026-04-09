const config = require('../config/app-config');
const logger = require('../core/logger');

async function openDashboard(page) {
  logger.info(`Opening dashboard at ${config.dashboardUrl}`);
  await page.goto(config.dashboardUrl, { waitUntil: 'domcontentloaded', timeout: config.timeout.pageLoad });
  // Could do a small wait just to ensure UI is ready
  await page.waitForTimeout(1000);
  logger.info('Dashboard opened successfully');
}

module.exports = openDashboard;
