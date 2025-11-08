import { useCallback, useEffect, useMemo, useState } from 'react'
import SplitView from '../components/SplitView'
import AssetPane from '../components/AssetPane'
import SheetTabs from '../components/SheetTabs'
import Spreadsheet from '../components/Spreadsheet'

export default function WorkbookView() {
  const [quoteId, setQuoteId] = useState<number | null>(null)
  const [sheets, setSheets] = useState<string[]>([])
  const [active, setActive] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const reload = useCallback(async () => {
    if (!quoteId) return
    const latest = await window.api.workbook.getLatest(quoteId)
    const names = await window.api.workbook.sheets.list(quoteId)
    setSheets(names)
    const activeName = latest.workbook.activeSheet || names[0] || null
    setActive(activeName)
    setRefreshKey(k => k + 1)
  }, [quoteId])

  useEffect(() => {
    window.api.quotes.ensureDefault().then(id => setQuoteId(id))
  }, [])

  useEffect(() => {
    if (quoteId) reload()
  }, [quoteId, reload])

  const left = useMemo(() => (
    <AssetPane />
  ), [])

  const right = useMemo(() => (
    <div className="workbook-pane">
      <div className="workbook-header">
        <div className="title">Workbook</div>
      </div>
      <SheetTabs quoteId={quoteId || 0} sheets={sheets} active={active || undefined} onChanged={reload} />
      <div className="sheet-container">
        {quoteId && active ? (
          <Spreadsheet quoteId={quoteId} sheetName={active} refreshKey={refreshKey} />
        ) : (
          <div className="placeholder">Chưa có sheet</div>
        )}
      </div>
    </div>
  ), [quoteId, sheets, active, refreshKey, reload])

  return <SplitView left={left} right={right} />
}
