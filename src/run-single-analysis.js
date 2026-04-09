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

  let browser;
  let context;
  try {
    browser = await chromium.launch({ headless: argv.headless });
    
    // Attempt to load storage state if it exists
    let contextOptions = {};
    const fs = require('fs');
    if (fs.existsSync(config.storageStatePath)) {
      contextOptions.storageState = config.storageStatePath;
      logger.info(`Using storage state from: ${config.storageStatePath}`);
    } else {
      logger.warn(`Storage state not found at ${config.storageStatePath}. You may be blocked by login.`);
    }

    context = await browser.newContext(contextOptions);
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
    logger.info('Closing browser and saving evidence pack...');
    if (context) await context.close();
    if (browser) await browser.close();
    
    packManager.save();
    logger.info(`Run ${runId} finished. Outputs are at: ${pathManager.runDir}`);
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
