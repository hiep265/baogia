import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

let _db: any | null = null

export function getDb() {
  if (!_db) {
    throw new Error('DB not initialized. Call initDb() first.')
  }
  return _db
}

export function initDb() {
  if (_db) return _db
  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })
  const dbPath = path.join(userData, 'db.sqlite')

  const Database = require('better-sqlite3') as any
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const now = () => Date.now()

  db.exec(`
    CREATE TABLE IF NOT EXISTS quotes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT,
      customer_name TEXT,
      customer_phone TEXT,
      company TEXT,
      tax_id TEXT,
      vat_rate REAL DEFAULT 0.1,
      discount_rate REAL DEFAULT 0,
      note TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_quotes_updated ON quotes(updated_at);

    CREATE TABLE IF NOT EXISTS quote_workbooks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      workbook_json TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_qw_quote_version ON quote_workbooks(quote_id, version);
    CREATE INDEX IF NOT EXISTS idx_qw_updated ON quote_workbooks(updated_at);
  `)

  _db = db
  return _db
}
