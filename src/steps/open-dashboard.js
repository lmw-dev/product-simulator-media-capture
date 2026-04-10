const config = require('../config/app-config');
const logger = require('../core/logger');

async function openDashboard(page) {
  logger.info(`Opening dashboard at ${config.dashboardUrl}`);
  await page.goto(config.dashboardUrl, { waitUntil: 'domcontentloaded', timeout: config.timeout.pageLoad });
  await page.waitForTimeout(1000);

  const currentUrl = page.url();
  const isLoginRedirect = currentUrl.includes('sign-in') || currentUrl.includes('sign-up') || currentUrl.includes('accounts.script-snap.com');

  if (isLoginRedirect) {
    throw new Error(
      `[AUTH REQUIRED] Redirected to login page: ${currentUrl}\n` +
      `  Auth state missing or expired. Run: node src/capture-auth-state.js`
    );
  }

  logger.info('Dashboard opened successfully');
}

module.exports = openDashboard;
