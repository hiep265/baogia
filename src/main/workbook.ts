import { getDb } from './db'

function now() { return Date.now() }

function getHF(): any {
  const mod = require('hyperformula')
  return mod.HyperFormula || mod
}

function colKeyToIndex(key: string): number {
  let n = 0
  for (let i = 0; i < key.length; i++) {
    n = n * 26 + (key.charCodeAt(i) - 64)
  }
  return n - 1
}

function ensureInitialWorkbook(quoteId: number) {
  const db = getDb()
  const q = db.prepare('SELECT 1 FROM quotes WHERE id=?').get(quoteId)
  if (!q) return
  const row = db.prepare('SELECT version, workbook_json FROM quote_workbooks WHERE quote_id=? ORDER BY version DESC LIMIT 1').get(quoteId)
  if (row) return
  const workbook = { version: 1, activeSheet: 'Sheet1', sheets: [ { name: 'Sheet1', columns: [], rows: [] } ] }
  const stmt = db.prepare('INSERT INTO quote_workbooks (quote_id, version, workbook_json, created_at, updated_at) VALUES (?,?,?,?,?)')
  const t = now()
  stmt.run(quoteId, 1, JSON.stringify(workbook), t, t)
}

export function getLatest(quoteId: number) {
  const db = getDb()
  const q = db.prepare('SELECT 1 FROM quotes WHERE id=?').get(quoteId)
  if (!q) { throw new Error('quote_not_found') }
  ensureInitialWorkbook(quoteId)
  const row = db.prepare('SELECT version, workbook_json FROM quote_workbooks WHERE quote_id=? ORDER BY version DESC LIMIT 1').get(quoteId)
  if (!row) {
    const workbook = { version: 1, activeSheet: 'Sheet1', sheets: [ { name: 'Sheet1', columns: [], rows: [] } ] }
    return { version: 1, workbook }
  }
  const workbook = JSON.parse(row.workbook_json)
  return { version: row.version as number, workbook }
}

function saveNewVersion(quoteId: number, workbook: any) {
  const db = getDb()
  const last = db.prepare('SELECT version FROM quote_workbooks WHERE quote_id=? ORDER BY version DESC LIMIT 1').get(quoteId)
  const nextVersion = (last?.version ?? 0) + 1
  workbook.version = nextVersion
  const t = now()
  db.prepare('INSERT INTO quote_workbooks (quote_id, version, workbook_json, created_at, updated_at) VALUES (?,?,?,?,?)')
    .run(quoteId, nextVersion, JSON.stringify(workbook), t, t)
  return { version: nextVersion }
}

export function sheetsList(quoteId: number) {
  const { workbook } = getLatest(quoteId)
  return workbook.sheets.map((s: any) => s.name)
}

export function sheetsAdd(quoteId: number, name: string) {
  const { workbook } = getLatest(quoteId)
  let final = name
  const exists = new Set(workbook.sheets.map((s: any) => s.name))
  let i = 1
  while (exists.has(final)) { final = `${name} (${i++})` }
  workbook.sheets.push({ name: final, columns: [], rows: [] })
  if (!workbook.activeSheet) workbook.activeSheet = final
  return saveNewVersion(quoteId, workbook)
}

export function sheetsRename(quoteId: number, oldName: string, newName: string) {
  const { workbook } = getLatest(quoteId)
  const s = workbook.sheets.find((x: any) => x.name === oldName)
  if (!s) return { error: 'not_found' }
  s.name = newName
  if (workbook.activeSheet === oldName) workbook.activeSheet = newName
  return saveNewVersion(quoteId, workbook)
}

export function sheetsRemove(quoteId: number, name: string) {
  const { workbook } = getLatest(quoteId)
  const idx = workbook.sheets.findIndex((x: any) => x.name === name)
  if (idx < 0) return { error: 'not_found' }
  workbook.sheets.splice(idx, 1)
  if (workbook.activeSheet === name) {
    workbook.activeSheet = workbook.sheets[0]?.name ?? null
  }
  return saveNewVersion(quoteId, workbook)
}

export function sheetsReorder(quoteId: number, order: string[]) {
  const { workbook } = getLatest(quoteId)
  const map = new Map(workbook.sheets.map((s: any) => [s.name, s]))
  const newSheets = [] as any[]
  for (const n of order) if (map.has(n)) newSheets.push(map.get(n))
  for (const s of workbook.sheets) if (!order.includes(s.name)) newSheets.push(s)
  workbook.sheets = newSheets
  return saveNewVersion(quoteId, workbook)
}

export function sheetsSetActive(quoteId: number, name: string) {
  const { workbook } = getLatest(quoteId)
  const exists = workbook.sheets.some((s: any) => s.name === name)
  if (!exists) return { error: 'not_found' }
  workbook.activeSheet = name
  return saveNewVersion(quoteId, workbook)
}

export type PatchOp =
  | { type: 'setCell'; sheet: string; row_uid: string; col: string; value?: any; t?: 'n'|'s'; f?: string }
  | { type: 'addRow'; sheet: string; row_uid: string }
  | { type: 'removeRow'; sheet: string; row_uid: string }
  | { type: 'addColumn'; sheet: string; col: string; name?: string }
  | { type: 'removeColumn'; sheet: string; col: string }

export function patch(quoteId: number, ops: PatchOp[]) {
  const { workbook } = getLatest(quoteId)
  for (const op of ops) {
    if (op.type === 'setCell') {
      const s = workbook.sheets.find((x: any) => x.name === op.sheet)
      if (!s) continue
      let row = s.rows.find((r: any) => r.uid === op.row_uid)
      if (!row) { row = { uid: op.row_uid, cells: {} }; s.rows.push(row) }
      const cell = row.cells[op.col] ?? {}
      if (op.f !== undefined) cell.f = op.f
      if (op.t !== undefined) cell.t = op.t
      if (op.value !== undefined) cell.v = op.value
      row.cells[op.col] = cell
    } else if (op.type === 'addRow') {
      const s = workbook.sheets.find((x: any) => x.name === op.sheet)
      if (!s) continue
      if (!s.rows.some((r: any) => r.uid === op.row_uid)) {
        s.rows.push({ uid: op.row_uid, cells: {} })
      }
    } else if (op.type === 'removeRow') {
      const s = workbook.sheets.find((x: any) => x.name === op.sheet)
      if (!s) continue
      s.rows = s.rows.filter((r: any) => r.uid !== op.row_uid)
    } else if (op.type === 'addColumn') {
      const s = workbook.sheets.find((x: any) => x.name === op.sheet)
      if (!s) continue
      s.columns = s.columns || []
      const exists = s.columns.some((c: any) => c.key === op.col)
      if (!exists) s.columns.push({ key: op.col, name: op.name ?? op.col })
    } else if (op.type === 'removeColumn') {
      const s = workbook.sheets.find((x: any) => x.name === op.sheet)
      if (!s) continue
      if (s.columns) s.columns = s.columns.filter((c: any) => c.key !== op.col)
      for (const r of s.rows) delete r.cells[op.col]
    }
  }
  return saveNewVersion(quoteId, workbook)
}

export function recalc(quoteId: number) {
  const latest = getLatest(quoteId)
  const wb = latest.workbook
  const hf = getHF().buildEmpty()
  const sheetIdMap = new Map<string, number>()
  for (const s of wb.sheets) {
    const data: any[][] = []
    const baseRow = s.columns && s.columns.length > 0 ? 2 : 1
    const rowMax = s.rows.length + (baseRow - 1)
    let colMax = 0
    for (let i = 0; i < s.rows.length; i++) {
      const r = s.rows[i]
      const arr: any[] = []
      for (const colKey in r.cells) {
        const j = colKeyToIndex(colKey)
        colMax = Math.max(colMax, j)
      }
    }
    for (let i = 0; i < rowMax; i++) data.push(new Array(colMax + 1).fill(null))
    for (let i = 0; i < s.rows.length; i++) {
      const r = s.rows[i]
      for (const colKey in r.cells) {
        const j = colKeyToIndex(colKey)
        const cell = r.cells[colKey]
        const rowNumber = baseRow + i
        data[rowNumber - 1][j] = cell.f ?? cell.v ?? null
      }
    }
    const id = hf.addSheet(s.name)
    sheetIdMap.set(s.name, id)
    if (data.length > 0) hf.setSheetContent(id, data)
  }
  for (const s of wb.sheets) {
    const id = sheetIdMap.get(s.name)!
    const baseRow = s.columns && s.columns.length > 0 ? 2 : 1
    for (let i = 0; i < s.rows.length; i++) {
      const r = s.rows[i]
      for (const colKey in r.cells) {
        const j = colKeyToIndex(colKey)
        const addr = { sheet: id, col: j, row: baseRow + i - 1 }
        const val = hf.getCellValue(addr as any)
        const cell = r.cells[colKey]
        if (cell && cell.f) {
          cell.v = val as any
        }
      }
    }
  }
  return saveNewVersion(quoteId, wb)
}
