const { chromium } = require('playwright');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const config = require('./config/app-config');
const PathManager = require('./core/paths');
const EvidencePackManager = require('./core/evidence-pack');
const logger = require('./core/logger');

// Steps
const openDashboard = require('./steps/open-dashboard');
const submitUrl = require('./steps/submit-url');
const waitResultPage = require('./steps/wait-result-page');
const captureArticle = require('./steps/capture-article');
const captureTweets = require('./steps/capture-tweets');

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('url', {
      alias: 'u',
      type: 'string',
      description: 'Target URL to analyze',
      demandOption: true
    })
    .option('headless', {
      type: 'boolean',
      description: 'Run browser in headless mode',
      default: !config.devMode
    })
    .parse();

  const targetUrl = argv.url;
  // Use a predictable run identifier based on date + timestamp snippet to ensure it's easy to read
  const snippet = Date.now().toString().slice(-6);
  const dateStr = new Date().toISOString().split('T')[0];
  const runId = `run-${dateStr}-${snippet}`;
  
  logger.info(`Starting execution. Run ID: ${runId}`);
  
  const pathManager = new PathManager(runId);
  const packManager = new EvidencePackManager(pathManager, {
    runId,
    sourceUrl: targetUrl
  });

  let context;
  try {
    const fs = require('fs');
    const path = require('path');

    const profilePath = path.join(config.chromeUserDataDir, config.chromeProfileDir);

    // Pre-flight: check dedicated profile exists
    if (!fs.existsSync(profilePath)) {
      throw new Error(
        `[SETUP REQUIRED] Dedicated Chrome profile not found: ${profilePath}\n` +
        `  Please run first: node src/capture-auth-state.js`
      );
    }
    logger.info(`Using Chrome profile: ${profilePath}`);

    // launchPersistentContext: Playwright uses real Chrome profile with existing login state.
    // This is the only approach that survives Google OAuth + Clerk's browser fingerprinting.
    // The profile stores the login session — no storageState injection needed.
    context = await chromium.launchPersistentContext(profilePath, {
      executablePath: config.chromeExecutablePath,
      headless: argv.headless,
      viewport: { width: 1440, height: 900 },
      args: [
        '--no-first-run',
        '--no-default-browser-check',
        '--disable-blink-features=AutomationControlled',
      ],
      ignoreDefaultArgs: ['--enable-automation'],
    });

    const page = await context.newPage();

    // 1. Open Dashboard
    packManager.updateStatus('running', 'opening_dashboard');
    await openDashboard(page);

    // 2. Submit URL
    packManager.updateStatus('running', 'submitting_url');
    await submitUrl(page, targetUrl);

    // 3. Wait Result
    const success = await waitResultPage(page, packManager);
    
    if (success) {
      // 4 & 5. Capture Evidence
      packManager.updateStatus('running', 'capturing_evidence');
      await captureArticle(page, packManager);
      await captureTweets(page, packManager);
      
      packManager.updateStatus('success', 'completed');
    }

  } catch (error) {
    logger.error(`Execution failed at stage '${packManager.pack.stage}': ${error.message}`);
    packManager.updateStatus('error', packManager.pack.stage, error.message);
  } finally {
    logger.info('Closing browser context and saving evidence pack...');
    if (context) await context.close();
    // Note: with launchPersistentContext, there is no separate browser object to close.

    packManager.save();
    logger.info(`Run ${runId} finished. Outputs are at: ${pathManager.runDir}`);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
