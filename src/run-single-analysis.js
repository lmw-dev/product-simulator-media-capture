const { chromium } = require('playwright');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const fs = require('fs');
const path = require('path');
const config = require('./config/app-config');
const PathManager = require('./core/paths');
const EvidencePackManager = require('./core/evidence-pack');
const logger = require('./core/logger');
const UrlPoolRepository = require('./core/url-pool-repo');

// Steps
const openDashboard = require('./steps/open-dashboard');
const submitUrl = require('./steps/submit-url');
const waitResultPage = require('./steps/wait-result-page');
const captureArticle = require('./steps/capture-article');
const captureTweets = require('./steps/capture-tweets');

async function main() {
  const startedAtMs = Date.now();
  const argv = yargs(hideBin(process.argv))
    .option('url', {
      alias: 'u',
      type: 'string',
      description: 'Target URL to analyze'
    })
    .option('from-pool', {
      type: 'boolean',
      description: 'Pick next pending URL from local sqlite URL pool',
      default: false
    })
    .option('pool-db', {
      type: 'string',
      description: 'Override sqlite URL pool db path'
    })
    .option('headless', {
      type: 'boolean',
      description: 'Run browser in headless mode',
      default: !config.devMode
    })
    .parse();

  // Use a predictable run identifier based on date + timestamp snippet to ensure it's easy to read
  const snippet = Date.now().toString().slice(-6);
  const dateStr = new Date().toISOString().split('T')[0];
  const runId = `run-${dateStr}-${snippet}`;

  let context;
  let pathManager = null;
  let packManager = null;
  let targetUrl = argv.url || null;
  let poolRepo = null;
  let poolRecord = null;
  let runFailed = false;

  try {
    if (argv.url && argv.fromPool) {
      throw new Error('Use either --url or --from-pool, not both.');
    }
    if (!argv.url && !argv.fromPool) {
      throw new Error('Missing input URL. Use --url or --from-pool.');
    }

    if (argv.fromPool) {
      poolRepo = new UrlPoolRepository(argv.poolDb || config.urlPoolDbPath);
      poolRecord = poolRepo.getNextPendingUrl();

      if (!poolRecord) {
        throw new Error(`[URL POOL EMPTY] No pending URL in ${argv.poolDb || config.urlPoolDbPath}`);
      }

      targetUrl = poolRecord.url;
      logger.info(`Picked URL from pool: id=${poolRecord.id}, sourceType=${poolRecord.source_type}, url=${targetUrl}`);
    }

    logger.info(`Starting execution. Run ID: ${runId}`);
    pathManager = new PathManager(runId);
    packManager = new EvidencePackManager(pathManager, {
      runId,
      sourceUrl: targetUrl
    });

    if (poolRecord) {
      const sourceSummary = `URL pool source: ${poolRecord.source_type}${poolRecord.source_name ? ` (${poolRecord.source_name})` : ''}`;
      packManager.setObservation(sourceSummary);
    }

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
    runFailed = true;
    const currentStage = packManager ? packManager.pack.stage : 'preflight';
    logger.error(`Execution failed at stage '${currentStage}': ${error.message}`);
    if (packManager) {
      packManager.updateStatus('error', packManager.pack.stage, error.message);
    }
  } finally {
    logger.info('Closing browser context and saving evidence pack...');
    if (context) await context.close();
    // Note: with launchPersistentContext, there is no separate browser object to close.

    if (packManager) {
      packManager.save();
      logger.info(`Run ${runId} finished. Outputs are at: ${pathManager.runDir}`);
    } else {
      logger.warn(`Run ${runId} finished without evidence pack (preflight failure).`);
    }

    if (poolRepo && poolRecord && packManager) {
      try {
        if (packManager.pack.status === 'success') {
          poolRepo.markProcessedById(poolRecord.id, {
            runId,
            notes: `Processed by runner (${runId}).`,
          });
          logger.info(`Pool URL marked as processed: id=${poolRecord.id}`);
        } else if (packManager.pack.status !== 'running') {
          poolRepo.markFailedById(poolRecord.id, {
            runId,
            error: packManager.pack.validation.errorState || `Runner failed at stage ${packManager.pack.stage}`,
            notes: `Marked failed by runner (${runId}).`,
          });
          logger.info(`Pool URL marked as failed: id=${poolRecord.id}`);
        }
      } catch (poolError) {
        logger.error(`Failed to update pool status for id=${poolRecord.id}: ${poolError.message}`);
      }
    }

    if (poolRepo) {
      poolRepo.close();
    }

    const outputsDir = path.join(__dirname, '../outputs');
    const latestMetaPath = path.join(outputsDir, 'latest-run-meta.json');
    try {
      fs.mkdirSync(outputsDir, { recursive: true });
      const latestMeta = {
        runId,
        runDir: pathManager ? pathManager.runDir : null,
        sourceUrl: targetUrl,
        status: packManager ? packManager.pack.status : (runFailed ? 'error' : 'unknown'),
        stage: packManager ? packManager.pack.stage : 'preflight',
        errorState: packManager?.pack?.validation?.errorState || null,
        startedAt: new Date(startedAtMs).toISOString(),
        finishedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAtMs
      };
      fs.writeFileSync(latestMetaPath, JSON.stringify(latestMeta, null, 2), 'utf-8');
      logger.info(`Latest run metadata saved to: ${latestMetaPath}`);
    } catch (metaError) {
      logger.warn(`Failed to write latest run metadata: ${metaError.message}`);
    }

    if (runFailed || (packManager && packManager.pack.status !== 'success')) {
      process.exitCode = 1;
    }
  }
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
