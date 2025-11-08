import { getDb } from './db'

function now() { return Date.now() }

export function ensureDefault() {
  const db = getDb()
  const row = db.prepare('SELECT id FROM quotes ORDER BY id LIMIT 1').get()
  if (row && row.id) return row.id as number
  const t = now()
  const info = db.prepare('INSERT INTO quotes (code, created_at, updated_at) VALUES (?, ?, ?)').run('QUOTE-0001', t, t)
  return Number(info.lastInsertRowid)
}
