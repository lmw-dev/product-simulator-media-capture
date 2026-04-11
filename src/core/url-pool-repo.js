const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const config = require('../config/app-config');
const { normalizeUrl } = require('./url-normalizer');

const VALID_STATUSES = new Set(['pending', 'processed', 'failed', 'skipped']);

class UrlPoolRepository {
  constructor(dbPath = config.urlPoolDbPath) {
    this.dbPath = dbPath;
    fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });

    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');

    this.initSchema();
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
    const payload = {
      id,
      status,
      updated_at: now,
      last_processed_at: status === 'pending' ? null : now,
      last_run_id: options.runId || null,
      last_error: status === 'failed' ? (options.error || null) : null,
      notes: options.notes || null,
    };

    const result = this.statements.updateStatusById.run(payload);
    if (result.changes === 0) {
      return null;
    }
    return this.statements.getById.get(id);
  }

  close() {
    if (this.db && this.db.open) {
      this.db.close();
    }
  }
}

module.exports = UrlPoolRepository;
