const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config/app-config');
const { normalizeUrl } = require('./url-normalizer');

const VALID_STATUSES = new Set(['pending', 'processed', 'failed', 'skipped']);

const RETRYABLE_ERROR_PATTERNS = [
  'timeout',
  'Failed to reach success state',
  'locator.waitFor: Timeout',
];
const NON_RETRYABLE_ERROR_PATTERNS = [
  'AUTH REQUIRED',
  'login page',
  'Auth state missing',
  'ProcessSingleton',
  'SingletonLock',
];
const MAX_RETRIES = 2;

class UrlPoolRepository {
  constructor(dbPath = config.urlPoolDbPath) {
    this.dbPath = dbPath;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initSchema();
    this.migrateSchema();
    this.prepareStatements();
  }

  initSchema() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS source_urls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        url TEXT NOT NULL UNIQUE,
        canonical_url TEXT NOT NULL UNIQUE,
        source_type TEXT NOT NULL,
        source_name TEXT,
        content_type TEXT,
        status TEXT NOT NULL DEFAULT 'pending'
          CHECK (status IN ('pending', 'processed', 'failed', 'skipped')),
        first_added_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        last_processed_at TEXT,
        last_run_id TEXT,
        last_error TEXT,
        notes TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_source_urls_status_added
      ON source_urls(status, first_added_at, id);
    `);
  }

  migrateSchema() {
    // Add retry_count column if missing
    const columns = this.db.prepare("PRAGMA table_info(source_urls)").all();
    const hasRetryCount = columns.some(c => c.name === 'retry_count');
    if (!hasRetryCount) {
      this.db.exec('ALTER TABLE source_urls ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0');
    }
  }

  prepareStatements() {
    this.statements = {
      insert: this.db.prepare(`
        INSERT INTO source_urls (
          url, canonical_url, source_type, source_name, content_type,
          status, first_added_at, updated_at, notes
        )
        VALUES (
          @url, @canonical_url, @source_type, @source_name, @content_type,
          'pending', @first_added_at, @updated_at, @notes
        )
        ON CONFLICT DO NOTHING
      `),
      getByCanonical: this.db.prepare(`
        SELECT *
        FROM source_urls
        WHERE canonical_url = ?
      `),
      getNextPending: this.db.prepare(`
        SELECT *
        FROM source_urls
        WHERE status = 'pending'
        ORDER BY first_added_at ASC, id ASC
        LIMIT 1
      `),
      getNextRetryable: this.db.prepare(`
        SELECT *
        FROM source_urls
        WHERE status = 'failed'
          AND retry_count < ?
          AND (last_error IS NULL OR last_error NOT LIKE '%AUTH REQUIRED%' AND last_error NOT LIKE '%login page%' AND last_error NOT LIKE '%ProcessSingleton%')
        ORDER BY retry_count ASC, updated_at ASC
        LIMIT 1
      `),
      updateStatusById: this.db.prepare(`
        UPDATE source_urls
        SET
          status = @status,
          updated_at = @updated_at,
          last_processed_at = @last_processed_at,
          last_run_id = @last_run_id,
          last_error = @last_error,
          notes = CASE
            WHEN @notes IS NULL OR TRIM(@notes) = '' THEN notes
            WHEN notes IS NULL OR TRIM(notes) = '' THEN @notes
            ELSE notes || CHAR(10) || @notes
          END
        WHERE id = @id
      `),
      getById: this.db.prepare(`
        SELECT *
        FROM source_urls
        WHERE id = ?
      `),
      listByStatus: this.db.prepare(`
        SELECT *
        FROM source_urls
        WHERE status = ?
        ORDER BY first_added_at ASC, id ASC
        LIMIT ?
      `),
    };
  }

  addUrl(input) {
    if (!input || typeof input !== 'object') {
      throw new Error('addUrl requires an input object');
    }
    if (!input.sourceType || !String(input.sourceType).trim()) {
      throw new Error('sourceType is required');
    }

    const now = new Date().toISOString();
    const canonicalUrl = normalizeUrl(input.url);
    const payload = {
      url: input.url.trim(),
      canonical_url: canonicalUrl,
      source_type: String(input.sourceType).trim(),
      source_name: input.sourceName || null,
      content_type: input.contentType || null,
      first_added_at: now,
      updated_at: now,
      notes: input.notes || null,
    };

    const result = this.statements.insert.run(payload);
    const row = this.statements.getByCanonical.get(canonicalUrl);
    return {
      inserted: result.changes > 0,
      row,
    };
  }

  getNextPendingUrl() {
    return this.statements.getNextPending.get() || null;
  }

  getByUrl(rawUrl) {
    const canonicalUrl = normalizeUrl(rawUrl);
    return this.statements.getByCanonical.get(canonicalUrl) || null;
  }

  listByStatus(status, limit = 20) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status: ${status}`);
    }
    return this.statements.listByStatus.all(status, limit);
  }

  markProcessedById(id, options = {}) {
    return this.markStatusById(id, 'processed', options);
  }

  markFailedById(id, options = {}) {
    return this.markStatusById(id, 'failed', options);
  }

  markSkippedById(id, options = {}) {
    return this.markStatusById(id, 'skipped', options);
  }

  markProcessedByUrl(rawUrl, options = {}) {
    return this.markStatusByUrl(rawUrl, 'processed', options);
  }

  markFailedByUrl(rawUrl, options = {}) {
    return this.markStatusByUrl(rawUrl, 'failed', options);
  }

  markSkippedByUrl(rawUrl, options = {}) {
    return this.markStatusByUrl(rawUrl, 'skipped', options);
  }

  markStatusByUrl(rawUrl, status, options = {}) {
    const row = this.getByUrl(rawUrl);
    if (!row) {
      return null;
    }
    return this.markStatusById(row.id, status, options);
  }

  markStatusById(id, status, options = {}) {
    if (!VALID_STATUSES.has(status)) {
      throw new Error(`Invalid status: ${status}`);
    }

    const now = new Date().toISOString();
    const current = this.statements.getById.get(id);
    const isRetry = status === 'failed' && current && this.isRetryableError(options.error);
    const newRetryCount = isRetry ? ((current.retry_count || 0) + 1) : (current ? current.retry_count : 0);

    const payload = {
      id,
      status,
      updated_at: now,
      last_processed_at: status === 'pending' ? null : now,
      last_run_id: options.runId || null,
      last_error: status === 'failed' ? (options.error || null) : null,
      notes: options.notes || null,
    };

    // Update retry_count separately (included in UPDATE only for failed+retryable)
    const result = this.statements.updateStatusById.run(payload);
    if (result.changes === 0) {
      return null;
    }
    if (isRetry) {
      this.db.prepare('UPDATE source_urls SET retry_count = ? WHERE id = ?').run(newRetryCount, id);
    }
    return this.statements.getById.get(id);
  }

  isRetryableError(errorMsg) {
    if (!errorMsg) return false;
    if (NON_RETRYABLE_ERROR_PATTERNS.some(p => errorMsg.includes(p))) return false;
    return RETRYABLE_ERROR_PATTERNS.some(p => errorMsg.includes(p));
  }

  getNextRetryableUrl() {
    return this.statements.getNextRetryable.get(MAX_RETRIES) || null;
  }

  resetToPending(id, options = {}) {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE source_urls
      SET status = 'pending', updated_at = ?, last_error = NULL,
          notes = CASE
            WHEN notes IS NULL OR TRIM(notes) = '' THEN ?
            ELSE notes || CHAR(10) || ?
          END
      WHERE id = ?
    `).run(now, options.notes || null, options.notes || null, id);
    if (result.changes === 0) return null;
    return this.statements.getById.get(id);
  }

  close() {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }
}

module.exports = UrlPoolRepository;
