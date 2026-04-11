#!/usr/bin/env node

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const UrlPoolRepository = require('./core/url-pool-repo');

function main() {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'url-pool-test-'));
  const dbPath = path.join(tempDir, 'pool.sqlite');
  const repo = new UrlPoolRepository(dbPath);

  try {
    const first = repo.addUrl({
      url: 'https://www.youtube.com/watch?v=abc123&utm_source=test',
      sourceType: 'manual',
      sourceName: 'self-test',
      contentType: 'youtube',
    });
    assert.strictEqual(first.inserted, true, 'first insert should succeed');

    const duplicate = repo.addUrl({
      url: 'https://youtu.be/abc123?si=foo',
      sourceType: 'manual',
      sourceName: 'self-test',
      contentType: 'youtube',
    });
    assert.strictEqual(duplicate.inserted, false, 'canonical duplicate should be deduped');

    const exactDuplicate = repo.addUrl({
      url: 'https://www.youtube.com/watch?v=abc123&utm_source=test',
      sourceType: 'manual',
      sourceName: 'self-test',
      contentType: 'youtube',
    });
    assert.strictEqual(exactDuplicate.inserted, false, 'exact duplicate should be deduped');

    const second = repo.addUrl({
      url: 'https://example.com/article?id=42',
      sourceType: 'rss',
      sourceName: 'example-feed',
      contentType: 'article',
    });
    assert.strictEqual(second.inserted, true, 'second unique url should insert');

    const next1 = repo.getNextPendingUrl();
    assert(next1, 'should return a pending record');
    assert.strictEqual(next1.id, first.row.id, 'first pending should be FIFO earliest');

    const processed = repo.markProcessedById(next1.id, { runId: 'run-test-001' });
    assert.strictEqual(processed.status, 'processed', 'status should update to processed');

    const next2 = repo.getNextPendingUrl();
    assert(next2, 'should still have one pending after first processed');
    assert.strictEqual(next2.id, second.row.id, 'second pending should be the remaining row');

    const skipped = repo.markSkippedByUrl('https://example.com/article?id=42', {
      runId: 'run-test-002',
      notes: 'content type out of scope',
    });
    assert.strictEqual(skipped.status, 'skipped', 'status should update to skipped');

    const next3 = repo.getNextPendingUrl();
    assert.strictEqual(next3, null, 'no pending row should remain');

    const failed = repo.addUrl({
      url: 'https://example.com/video/999?utm_campaign=x',
      sourceType: 'manual',
      sourceName: 'self-test',
      contentType: 'video',
    });
    assert.strictEqual(failed.inserted, true, 'third unique url should insert');
    const failedRow = repo.markFailedById(failed.row.id, {
      runId: 'run-test-003',
      error: 'simulated failure',
    });
    assert.strictEqual(failedRow.status, 'failed', 'status should update to failed');
    assert.strictEqual(failedRow.last_error, 'simulated failure', 'failure reason should persist');

    console.log('[url-pool-self-test] PASS');
  } finally {
    repo.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

main();
