#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const UrlPoolRepository = require('./core/url-pool-repo');

function printRow(row) {
  if (!row) {
    console.log('No record found.');
    return;
  }
  console.log(JSON.stringify(row, null, 2));
}

function withRepo(dbPath, fn) {
  const repo = new UrlPoolRepository(dbPath);
  try {
    return fn(repo);
  } finally {
    repo.close();
  }
}

yargs(hideBin(process.argv))
  .scriptName('url-pool')
  .option('db-path', {
    type: 'string',
    description: 'Override sqlite db path',
  })
  .command(
    'add',
    'Add a URL into pool (dedup by canonical url)',
    (cmd) => cmd
      .option('url', { type: 'string', demandOption: true })
      .option('source-type', { type: 'string', demandOption: true })
      .option('source-name', { type: 'string' })
      .option('content-type', { type: 'string' })
      .option('notes', { type: 'string' }),
    (argv) => withRepo(argv.dbPath, (repo) => {
      const result = repo.addUrl({
        url: argv.url,
        sourceType: argv.sourceType,
        sourceName: argv.sourceName,
        contentType: argv.contentType,
        notes: argv.notes,
      });
      if (result.inserted) {
        console.log('Added URL into pool.');
      } else {
        console.log('URL already exists (deduped).');
      }
      printRow(result.row);
    })
  )
  .command(
    'next',
    'Get next pending URL',
    () => {},
    (argv) => withRepo(argv.dbPath, (repo) => {
      const row = repo.getNextPendingUrl();
      printRow(row);
    })
  )
  .command(
    'get',
    'Query record by URL',
    (cmd) => cmd.option('url', { type: 'string', demandOption: true }),
    (argv) => withRepo(argv.dbPath, (repo) => {
      const row = repo.getByUrl(argv.url);
      printRow(row);
    })
  )
  .command(
    'mark',
    'Update status to processed / failed / skipped',
    (cmd) => cmd
      .option('id', { type: 'number' })
      .option('url', { type: 'string' })
      .option('status', {
        type: 'string',
        choices: ['processed', 'failed', 'skipped'],
        demandOption: true,
      })
      .option('run-id', { type: 'string' })
      .option('error', { type: 'string' })
      .option('notes', { type: 'string' })
      .check((args) => {
        if (!args.id && !args.url) {
          throw new Error('Either --id or --url is required.');
        }
        return true;
      }),
    (argv) => withRepo(argv.dbPath, (repo) => {
      let row = null;
      const options = {
        runId: argv.runId,
        error: argv.error,
        notes: argv.notes,
      };

      if (argv.id) {
        row = repo.markStatusById(argv.id, argv.status, options);
      } else {
        row = repo.markStatusByUrl(argv.url, argv.status, options);
      }

      if (!row) {
        console.error('Record not found or not updated.');
        process.exitCode = 1;
        return;
      }

      console.log(`Marked as ${argv.status}.`);
      printRow(row);
    })
  )
  .command(
    'list',
    'List records by status',
    (cmd) => cmd
      .option('status', {
        type: 'string',
        choices: ['pending', 'processed', 'failed', 'skipped'],
        demandOption: true,
      })
      .option('limit', { type: 'number', default: 20 }),
    (argv) => withRepo(argv.dbPath, (repo) => {
      const rows = repo.listByStatus(argv.status, argv.limit);
      console.log(JSON.stringify(rows, null, 2));
    })
  )
  .demandCommand(1)
  .strict()
  .help()
  .parse();
