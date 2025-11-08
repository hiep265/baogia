import { useCallback, useEffect, useMemo, useState } from 'react'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-quartz.css'

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

function indexToColKey(n: number) {
  let s = ''
  let x = n + 1
  while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26) }
  return s
}

const DEFAULT_COL_COUNT = 26
const DEFAULT_ROW_COUNT = 100

type Props = {
  quoteId: number
  sheetName: string
  refreshKey: number
}

export default function Spreadsheet({ quoteId, sheetName, refreshKey }: Props) {
  const [rowData, setRowData] = useState<any[]>([])
  const [colKeys, setColKeys] = useState<string[]>([])

  const columnDefs = useMemo<ColDef[]>(() => {
    const rowNoCol: ColDef = { headerName: '', field: '__rowNo', width: 56, pinned: 'left', editable: false, resizable: false, valueGetter: p => (p.node && p.node.rowIndex != null ? p.node.rowIndex + 1 : '') }
    const cols = colKeys.map(k => ({ headerName: k, field: k, editable: true, resizable: true }))
    return [rowNoCol, ...cols]
  }, [colKeys])

  const load = useCallback(async () => {
    const latest = await window.api.workbook.getLatest(quoteId)
    const wb = latest.workbook
    const s = wb.sheets.find(x => x.name === sheetName)
    if (!s) {
      const keys = Array.from({ length: DEFAULT_COL_COUNT }, (_, i) => indexToColKey(i))
      setColKeys(keys)
      const data: any[] = []
      for (let i = 0; i < DEFAULT_ROW_COUNT; i++) {
        const obj: any = { _uid: `row-${String(i + 1).padStart(4, '0')}` }
        for (const k of keys) obj[k] = null
        data.push(obj)
      }
      setRowData(data)
      return
    }

    const defaultKeys = Array.from({ length: DEFAULT_COL_COUNT }, (_, i) => indexToColKey(i))
    let usedKeys: string[] = []
    if (s.columns && s.columns.length > 0) usedKeys = s.columns.map((c: any) => c.key)
    else {
      const set = new Set<string>()
      for (const r of s.rows) for (const k in r.cells) set.add(k)
      usedKeys = Array.from(set)
    }
    const extras = usedKeys.filter(k => !defaultKeys.includes(k))
    const keys = [...defaultKeys, ...extras]
    setColKeys(keys)

    const data: any[] = []
    const usedCount = Math.max(s.rows.length, 0)
    for (let i = 0; i < Math.max(usedCount, DEFAULT_ROW_COUNT); i++) {
      if (i < s.rows.length) {
        const r = s.rows[i]
        const obj: any = { _uid: r.uid }
        for (const k of keys) obj[k] = r.cells[k]?.v ?? r.cells[k]?.f ?? null
        data.push(obj)
      } else {
        const obj: any = { _uid: `row-${String(i + 1).padStart(4, '0')}` }
        for (const k of keys) obj[k] = null
        data.push(obj)
      }
    }
    setRowData(data)
  }, [quoteId, sheetName])

  useEffect(() => { load() }, [load, refreshKey])

  const onCellValueChanged = useCallback(async (event: any) => {
    const col = event.colDef.field as string
    const value = event.newValue
    const row = event.data
    const row_uid = row._uid as string
    const ops: any[] = []
    if (typeof value === 'string' && value.startsWith('=')) {
      ops.push({ type: 'setCell', sheet: sheetName, row_uid, col, f: value })
    } else if (isNumeric(value)) {
      ops.push({ type: 'setCell', sheet: sheetName, row_uid, col, t: 'n', value: Number(value) })
    } else {
      ops.push({ type: 'setCell', sheet: sheetName, row_uid, col, t: 's', value: value })
    }
    await window.api.workbook.patch(quoteId, { ops })
    await window.api.workbook.recalc(quoteId)
    await load()
  }, [quoteId, sheetName, load])

  const addRow = useCallback(async () => {
    const uid = 'row-' + Math.random().toString(36).slice(2)
    await window.api.workbook.patch(quoteId, { ops: [{ type: 'addRow', sheet: sheetName, row_uid: uid }] })
    await load()
  }, [quoteId, sheetName, load])

  const addCol = useCallback(async () => {
    const keys = [...colKeys]
    const newKey = nextColKey(keys)
    await window.api.workbook.patch(quoteId, { ops: [{ type: 'addColumn', sheet: sheetName, col: newKey }] })
    await load()
  }, [quoteId, sheetName, colKeys, load])

  const removeRow = useCallback(async () => {
    const latest = await window.api.workbook.getLatest(quoteId)
    const s = latest.workbook.sheets.find(x => x.name === sheetName)
    if (!s || s.rows.length === 0) return
    const uid = s.rows[s.rows.length - 1].uid
    await window.api.workbook.patch(quoteId, { ops: [{ type: 'removeRow', sheet: sheetName, row_uid: uid }] })
    await load()
  }, [quoteId, sheetName, load])

  const removeCol = useCallback(async () => {
    if (colKeys.length === 0) return
    const col = colKeys[colKeys.length - 1]
    await window.api.workbook.patch(quoteId, { ops: [{ type: 'removeColumn', sheet: sheetName, col }] })
    await load()
  }, [quoteId, sheetName, colKeys, load])

  return (
    <div className="sheet-pane">
      <div className="sheet-toolbar">
        <button className="btn" onClick={addRow}>Thêm hàng</button>
        <button className="btn" onClick={addCol}>Thêm cột</button>
        <div className="spacer" />
        <button className="btn ghost" onClick={removeRow}>Xoá hàng cuối</button>
        <button className="btn ghost" onClick={removeCol}>Xoá cột cuối</button>
      </div>
      <div className="ag-theme-quartz grid" style={{ width: '100%', height: '100%' }}>
        <AgGridReact
          rowData={rowData}
          columnDefs={columnDefs}
          defaultColDef={{ editable: true, resizable: true }}
          stopEditingWhenCellsLoseFocus={true}
          onCellValueChanged={onCellValueChanged}
        />
      </div>
    </div>
  )
}
