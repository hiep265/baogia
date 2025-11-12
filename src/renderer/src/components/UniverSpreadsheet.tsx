import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import sheetsCoreViVN from '@univerjs/preset-sheets-core/locales/vi-VN'
import '@univerjs/preset-sheets-core/lib/index.css'
import { UniverSheetsDrawingPreset } from '@univerjs/preset-sheets-drawing'
import '@univerjs/preset-sheets-drawing/lib/index.css'
import { UniverSheetsAdvancedPreset } from '@univerjs/preset-sheets-advanced'
import '@univerjs/preset-sheets-advanced/lib/index.css'
import { UniverSheetsMarkColumnPlugin } from './UniverMarkColumnPlugin'

const DEFAULT_COL_COUNT = 26
const DEFAULT_ROW_COUNT = 100
const UNIVERSER_ENDPOINT = (import.meta as any).env?.VITE_UNIVERSER_ENDPOINT || 'http://localhost:3010'

function colKeyToIndex(key: string): number {
  let n = 0
  for (let i = 0; i < key.length; i++) n = n * 26 + (key.charCodeAt(i) - 64)
  return n - 1
}

function indexToColKey(n: number) {
  let s = ''
  let x = n + 1
  while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26) }
  return s
}

function nextColKey(keys: string[]) {
  if (keys.length === 0) return 'A'
  const last = keys[keys.length - 1]
  let n = 0
  for (let i = 0; i < last.length; i++) n = n * 26 + (last.charCodeAt(i) - 64)
  n += 1
  let s = ''
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26) }
  return s
}

function isNumeric(val: any) {
  if (typeof val === 'number') return true
  if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) return true
  return false
}

function sheetNameOf(s: any): string {
  try {
    if (typeof s?.getName === 'function') return s.getName()
    if (typeof s?.getSheet === 'function') {
      const inner = s.getSheet()
      if (inner && typeof inner.getName === 'function') return inner.getName()
    }
    if (typeof s?.name === 'string') return s.name
  } catch {}
  return ''
}

type Props = {
  quoteId: number
  sheetName: string
  refreshKey: number
}

export default function UniverSpreadsheet({ quoteId, sheetName, refreshKey }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const univerRef = useRef<any>(null)
  const unitIdRef = useRef<string | null>(null)
  const [colKeys, setColKeys] = useState<string[]>([])
  const lastSnapshotsRef = useRef<Record<string, any>>({})
  const rowIndexUidMapRef = useRef<Record<string, Record<number, string>>>({})
  const changeTimersRef = useRef<Record<string, any>>({})
  const disposersRef = useRef<Array<() => void>>([])

  const initUniver = useCallback(() => {
    if (univerRef.current || !containerRef.current) return
    const { univer, univerAPI } = createUniver({
      locale: LocaleType.VI_VN,
      locales: { [LocaleType.VI_VN]: mergeLocales(sheetsCoreViVN) },
      presets: [
        UniverSheetsCorePreset({
          container: containerRef.current,
          header: true,
          toolbar: true,
          ribbonType: 'default',
          footer: { sheetBar: true, statisticBar: true, menus: true, zoomSlider: true },
        }),
        UniverSheetsDrawingPreset(),
        UniverSheetsAdvancedPreset({
          universerEndpoint: UNIVERSER_ENDPOINT,
        }),
      ],
      plugins: [
        [UniverSheetsMarkColumnPlugin, {}],
      ],
    })
    univerRef.current = { univer, univerAPI }
    ;(window as any).__univer = { univer, univerAPI }
  }, [])

  const buildWorkbookData = useCallback(async () => {
    const latest = await window.api.workbook.getLatest(quoteId)
    const wb = latest.workbook as any

    const sheetIds: string[] = []
    const sheets: Record<string, any> = {}

    for (const s of wb.sheets as any[]) {
      const usedColIdx = new Set<number>()
      if (s.columns && s.columns.length > 0) {
        for (const c of s.columns) usedColIdx.add(colKeyToIndex(c.key))
      }
      for (const r of s.rows) for (const k in r.cells) usedColIdx.add(colKeyToIndex(k))
      const maxCol = usedColIdx.size > 0 ? Math.max(...Array.from(usedColIdx)) : -1
      const columnCount = Math.max(DEFAULT_COL_COUNT, maxCol + 1)
      const baseRow = s.columns && s.columns.length > 0 ? 1 : 0
      const rowCount = Math.max(DEFAULT_ROW_COUNT, (s.rows?.length || 0) + baseRow)

      const cellData: any = {}
      if (s.columns && s.columns.length > 0) {
        cellData[0] = cellData[0] || {}
        for (const c of s.columns) {
          const j = colKeyToIndex(c.key)
          cellData[0][j] = { v: c.name || c.key }
        }
      }
      for (let i = 0; i < (s.rows?.length || 0); i++) {
        const r = s.rows[i]
        const rowIndex = baseRow + i
        cellData[rowIndex] = cellData[rowIndex] || {}
        for (const k in r.cells) {
          const j = colKeyToIndex(k)
          const cell = r.cells[k]
          if (typeof cell?.f === 'string') cellData[rowIndex][j] = { f: cell.f }
          else if (cell?.v !== undefined && cell?.v !== null) cellData[rowIndex][j] = { v: cell.v }
        }
      }

      const sheetId = `sheet-${s.name}`
      sheetIds.push(sheetId)
      sheets[sheetId] = {
        id: sheetId,
        name: s.name,
        rowCount,
        columnCount,
        cellData,
      }

      if (s.name === sheetName) {
        const defaultKeys = Array.from({ length: DEFAULT_COL_COUNT }, (_, i) => indexToColKey(i))
        const keysFromColumns = s.columns?.map((c: any) => c.key) || []
        const keysFromRows = Array.from(new Set<string>(s.rows?.flatMap((r: any) => Object.keys(r.cells || {})) || []))
        const union = Array.from(new Set<string>([...defaultKeys, ...keysFromColumns, ...keysFromRows]))
        setColKeys(union)
      }
    }

    const data: any = {
      id: `quote-${quoteId}`,
      name: 'Workbook',
      locale: LocaleType.VI_VN,
      styles: {},
      sheetOrder: sheetIds,
      sheets,
    }
    return data
  }, [quoteId, sheetName])

  const load = useCallback(async () => {
    if (!univerRef.current) return
    const { univerAPI } = univerRef.current
    const data = await buildWorkbookData()
    const prevActiveSheet = univerAPI.getActiveWorkbook()?.getActiveSheet?.()
    const prevActiveName = prevActiveSheet ? sheetNameOf(prevActiveSheet) : undefined
    if (unitIdRef.current) {
      try { univerAPI.disposeUnit(unitIdRef.current) } catch {}
      unitIdRef.current = null
    }
    const fWorkbook = univerAPI.createWorkbook(data)
    unitIdRef.current = fWorkbook.getId()
    const nameToActivate = prevActiveName || sheetName
    const sheetsArr = fWorkbook.getSheets()
    const target = sheetsArr.find((s: any) => sheetNameOf(s) === nameToActivate)
    if (target) fWorkbook.setActiveSheet(target)

    // Initialize snapshots for diffing
    const sheets = fWorkbook.getSheets()
    for (const s of sheets) {
      try {
        const name = sheetNameOf(s)
        let snap: any = null
        if (typeof (s as any)?.getSheet === 'function') {
          const inner = (s as any).getSheet()
          if (inner && typeof inner.getSnapshot === 'function') snap = inner.getSnapshot()
        } else if (typeof (s as any)?.getSnapshot === 'function') {
          snap = (s as any).getSnapshot()
        }
        lastSnapshotsRef.current[name] = { cellData: snap?.cellData || {} }
      } catch {}
    }

    // Attach cell change listeners
    try {
      // cleanup old
      for (const d of disposersRef.current) { try { d() } catch {} }
      disposersRef.current = []
      for (const s of sheets) {
        const name = sheetNameOf(s)
        const disposer = (s as any).onCellDataChange?.(() => {
          if (changeTimersRef.current[name]) clearTimeout(changeTimersRef.current[name])
          changeTimersRef.current[name] = setTimeout(() => {
            persistSheetChanges(name).catch(() => {})
          }, 300)
        })
        if (typeof disposer === 'function') disposersRef.current.push(disposer)
      }
    } catch {}
  }, [buildWorkbookData, sheetName])

  useEffect(() => { initUniver() }, [initUniver])
  useEffect(() => {
    return () => {
      try {
        if (univerRef.current?.univerAPI) {
          univerRef.current.univerAPI.dispose()
        }
        univerRef.current = null
        unitIdRef.current = null
      } catch {}
    }
  }, [])
  useEffect(() => { if (quoteId && sheetName && univerRef.current) { load() } }, [quoteId, sheetName, refreshKey, load])

  const persistSheetChanges = useCallback(async (name: string) => {
    if (!univerRef.current) return
    const { univerAPI } = univerRef.current
    const fWorkbook = univerAPI.getActiveWorkbook()
    if (!fWorkbook) return
    const fWorksheet = fWorkbook.getSheets().find((s: any) => s.getName() === name)
    if (!fWorksheet) return

    // New snapshot
    const snap = fWorksheet.getSheet().getSnapshot()
    const newCells: any = snap?.cellData || {}
    const oldCells: any = (lastSnapshotsRef.current[name]?.cellData) || {}

    const rows = new Set<string>([...Object.keys(newCells), ...Object.keys(oldCells)])
    const ops: any[] = []

    // Fetch backend mapping
    const latest = await window.api.workbook.getLatest(quoteId)
    const s = latest.workbook.sheets.find((x: any) => x.name === name)
    if (!s) return
    const hasHeader = !!(s.columns && s.columns.length > 0)
    const baseRow = hasHeader ? 1 : 0
    rowIndexUidMapRef.current[name] = rowIndexUidMapRef.current[name] || {}

    for (const rKey of rows) {
      const r = Number(rKey)
      const newRow = newCells[rKey] || {}
      const oldRow = oldCells[rKey] || {}
      const cols = new Set<string>([...Object.keys(newRow), ...Object.keys(oldRow)])
      for (const cKey of cols) {
        const c = Number(cKey)
        const n = newRow[cKey]
        const o = oldRow[cKey]
        const nVal = n?.f ?? n?.v
        const oVal = o?.f ?? o?.v
        if (nVal === oVal) continue
        if (r < baseRow) continue // ignore header row edits
        const dataIndex = r - baseRow
        let row_uid = s.rows[dataIndex]?.uid
        if (!row_uid) {
          row_uid = rowIndexUidMapRef.current[name][r] || ('row-' + Math.random().toString(36).slice(2))
          rowIndexUidMapRef.current[name][r] = row_uid
        }
        const col = indexToColKey(c)
        if (typeof n?.f === 'string') {
          ops.push({ type: 'setCell', sheet: name, row_uid, col, f: n.f })
        } else if (isNumeric(nVal)) {
          ops.push({ type: 'setCell', sheet: name, row_uid, col, t: 'n', value: Number(nVal) })
        } else {
          ops.push({ type: 'setCell', sheet: name, row_uid, col, t: 's', value: nVal ?? null })
        }
      }
    }

    if (ops.length > 0) {
      await window.api.workbook.patch(quoteId, { ops })
      await window.api.workbook.recalc(quoteId)
      lastSnapshotsRef.current[name] = { cellData: newCells }
    }
  }, [quoteId])

  const addRow = useCallback(async () => {
    const currentName = univerRef.current?.univerAPI?.getActiveWorkbook()?.getActiveSheet()?.getName() || sheetName
    const uid = 'row-' + Math.random().toString(36).slice(2)
    await window.api.workbook.patch(quoteId, { ops: [{ type: 'addRow', sheet: currentName, row_uid: uid }] })
    await load()
  }, [quoteId, sheetName, load])

  const addCol = useCallback(async () => {
    const currentName = univerRef.current?.univerAPI?.getActiveWorkbook()?.getActiveSheet()?.getName() || sheetName
    const latest = await window.api.workbook.getLatest(quoteId)
    const s = latest.workbook.sheets.find((x: any) => x.name === currentName)
    const keysFromColumns = s?.columns?.map((c: any) => c.key) || []
    const keysFromRows = Array.from(new Set<string>(s?.rows?.flatMap((r: any) => Object.keys(r.cells || {})) || []))
    const union = Array.from(new Set<string>([...keysFromColumns, ...keysFromRows]))
    const newKey = nextColKey(union)
    await window.api.workbook.patch(quoteId, { ops: [{ type: 'addColumn', sheet: currentName, col: newKey }] })
    await load()
  }, [quoteId, sheetName, load])

  const removeRow = useCallback(async () => {
    const currentName = univerRef.current?.univerAPI?.getActiveWorkbook()?.getActiveSheet()?.getName() || sheetName
    const latest = await window.api.workbook.getLatest(quoteId)
    const s = latest.workbook.sheets.find((x: any) => x.name === currentName)
    if (!s || s.rows.length === 0) return
    const uid = s.rows[s.rows.length - 1].uid
    await window.api.workbook.patch(quoteId, { ops: [{ type: 'removeRow', sheet: currentName, row_uid: uid }] })
    await load()
  }, [quoteId, sheetName, load])

  const removeCol = useCallback(async () => {
    const currentName = univerRef.current?.univerAPI?.getActiveWorkbook()?.getActiveSheet()?.getName() || sheetName
    const latest = await window.api.workbook.getLatest(quoteId)
    const s = latest.workbook.sheets.find((x: any) => x.name === currentName)
    const keysFromColumns = s?.columns?.map((c: any) => c.key) || []
    const keysFromRows = Array.from(new Set<string>(s?.rows?.flatMap((r: any) => Object.keys(r.cells || {})) || []))
    const union = Array.from(new Set<string>([...keysFromColumns, ...keysFromRows]))
    if (union.length === 0) return
    const col = union[union.length - 1]
    await window.api.workbook.patch(quoteId, { ops: [{ type: 'removeColumn', sheet: currentName, col }] })
    await load()
  }, [quoteId, sheetName, load])

  return (
    <div className="grid" style={{ width: '100%', height: '100%' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  )
}
