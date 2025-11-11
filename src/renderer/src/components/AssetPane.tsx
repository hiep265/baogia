import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
import * as XLSX from 'xlsx'
;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type Item = { id: string; name: string; type: 'image' | 'pdf'; url: string; thumbUrl?: string; pageCount?: number; data?: Uint8Array }

function indexToColKey(n: number) {
  let s = ''
  let x = n + 1
  while (x > 0) { const r = (x - 1) % 26; s = String.fromCharCode(65 + r) + s; x = Math.floor((x - 1) / 26) }
  return s
}

function isNumeric(val: any) {
  if (typeof val === 'number') return true
  if (typeof val === 'string' && val.trim() !== '' && !isNaN(Number(val))) return true
  return false
}

export default function AssetPane({ quoteId, onWorkbookChanged }: { quoteId?: number; onWorkbookChanged?: () => void }) {
  const [items, setItems] = useState<Item[]>([])
  const imagesInputRef = useRef<HTMLInputElement | null>(null)
  const pdfInputRef = useRef<HTMLInputElement | null>(null)
  const excelInputRef = useRef<HTMLInputElement | null>(null)
  const paneRef = useRef<HTMLDivElement | null>(null)
  const [gridMin, setGridMin] = useState<number>(120)

  const viewerContainerRef = useRef<HTMLDivElement | null>(null)
  const pagesWrapRef = useRef<HTMLDivElement | null>(null)
  const pdfDocRef = useRef<any>(null)
  const [viewer, setViewer] = useState<{ open: boolean; item?: Item; page: number; pageCount?: number }>({ open: false, page: 1 })
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [viewerRenderKey, setViewerRenderKey] = useState(0)
  const [allOpen, setAllOpen] = useState(false)
  const allContainerRef = useRef<HTMLDivElement | null>(null)
  const [allRenderKey, setAllRenderKey] = useState(0)
  const allPdfDocsRef = useRef<Map<string, any>>(new Map())

  const onPickImages = useCallback(() => { imagesInputRef.current?.click() }, [])
  const onPickPdfs = useCallback(() => { pdfInputRef.current?.click() }, [])
  const onPickExcel = useCallback(() => { excelInputRef.current?.click() }, [])

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files)
    for (const f of arr) {
      if (f.type.startsWith('image/')) {
        const url = URL.createObjectURL(f)
        const it: Item = { id: Math.random().toString(36).slice(2), name: f.name, type: 'image', url }
        setItems(prev => [it, ...prev])
      } else if (f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')) {
        const buf = await f.arrayBuffer()
        // Create two independent copies to avoid reuse of a transferred buffer
        const bufThumb = buf.slice(0)
        const bufStore = buf.slice(0)
        const dataArrThumb = new Uint8Array(bufThumb)
        const dataArrStore = new Uint8Array(bufStore)
        ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl
        const loadingTask = pdfjsLib.getDocument({ data: dataArrThumb, disableWorker: true })
        const pdf = await loadingTask.promise
        const page = await pdf.getPage(1)
        const vp = page.getViewport({ scale: 0.4 })
        const canvas = document.createElement('canvas')
        const ratio = window.devicePixelRatio || 1
        canvas.width = vp.width * ratio
        canvas.height = vp.height * ratio
        const ctx = canvas.getContext('2d')!
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        const thumbUrl = canvas.toDataURL('image/png')
        const blob = new Blob([dataArrStore], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const it: Item = { id: Math.random().toString(36).slice(2), name: f.name, type: 'pdf', url, thumbUrl, pageCount: pdf.numPages, data: dataArrStore }
        setItems(prev => [it, ...prev])
      }
    }
  }, [])

  const [excelBusy, setExcelBusy] = useState(false)
  const handleExcelFiles = useCallback(async (files: FileList | null) => {
    if (!files || !quoteId) return
    setExcelBusy(true)
    try {
      for (const f of Array.from(files)) {
        const baseName = f.name.replace(/\.[^.]+$/, '')
        const ab = await f.arrayBuffer()
        const wb = XLSX.read(ab, { type: 'array' })
        let lastImportedSheet: string | null = null
        for (const sh of wb.SheetNames) {
          const ws = wb.Sheets[sh]
          const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true }) as any
          if (!rows || rows.length === 0) continue
          const header = (rows[0] as any[]) || []
          const colCount = Math.max(header.length, ...rows.map(r => r?.length || 0))
          const preferred = wb.SheetNames.length === 1 ? baseName : `${baseName}-${sh}`
          let names: string[] = []
          try { names = await (window as any).api.workbook.sheets.list(quoteId) } catch {}
          const exists = new Set(names)
          let i = 1
          let targetName = preferred
          while (exists.has(targetName)) targetName = `${preferred} (${i++})`
          try { await (window as any).api.workbook.sheets.add(quoteId, targetName) } catch {}
          const ops: any[] = []
          for (let j = 0; j < colCount; j++) {
            const colKey = indexToColKey(j)
            const name = (header[j] !== undefined && header[j] !== null && String(header[j]).trim() !== '') ? String(header[j]) : colKey
            ops.push({ type: 'addColumn', sheet: targetName, col: colKey, name })
          }
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i] || []
            const row_uid = 'row-' + Math.random().toString(36).slice(2)
            ops.push({ type: 'addRow', sheet: targetName, row_uid })
            for (let j = 0; j < Math.min(colCount, row.length); j++) {
              const val = row[j]
              if (val === undefined || val === null || val === '') continue
              const colKey = indexToColKey(j)
              if (typeof val === 'string' && val.startsWith('=')) {
                ops.push({ type: 'setCell', sheet: targetName, row_uid, col: colKey, f: val })
              } else if (isNumeric(val)) {
                ops.push({ type: 'setCell', sheet: targetName, row_uid, col: colKey, t: 'n', value: Number(val) })
              } else {
                ops.push({ type: 'setCell', sheet: targetName, row_uid, col: colKey, t: 's', value: String(val) })
              }
            }
          }
          if (ops.length > 0) await (window as any).api.workbook.patch(quoteId, { ops })
          lastImportedSheet = targetName
        }
        if (lastImportedSheet) {
          try { await (window as any).api.workbook.recalc(quoteId) } catch {}
          try { await (window as any).api.workbook.sheets.setActive(quoteId, lastImportedSheet) } catch {}
        }
      }
      if (onWorkbookChanged) onWorkbookChanged()
    } finally {
      setExcelBusy(false)
    }
  }, [quoteId, onWorkbookChanged])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    await handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
  }, [])

  const onOpenItem = useCallback((it: Item) => {
    setViewerError(null)
    setViewer({ open: true, item: it, page: 1, pageCount: it.pageCount })
  }, [])

  const onCloseViewer = useCallback(() => {
    setViewer({ open: false, page: 1 })
    setViewerError(null)
    try { pdfDocRef.current?.destroy?.() } catch {}
    pdfDocRef.current = null
  }, [])
  const onCloseAll = useCallback(() => {
    setAllOpen(false)
    try { allPdfDocsRef.current.forEach(d => d?.destroy?.()) } catch {}
    allPdfDocsRef.current.clear()
  }, [])

  

  useEffect(() => {
    const el = paneRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0].contentRect.width
      const min = Math.max(120, Math.min(220, Math.floor(w / 3) - 16))
      setGridMin(min)
    })
    ro.observe(el)
    return () => { try { ro.disconnect() } catch {} }
  }, [])

  useEffect(() => {
    if (!viewer.open || !viewer.item) return
    if (viewer.item.type !== 'pdf') return
    const item = viewer.item
    let aborted = false
    const load = async () => {
      try {
        try { pdfDocRef.current?.destroy?.() } catch {}
        pdfDocRef.current = null
        // Prefer URL loading (object URL) to avoid transferring an ArrayBuffer at all
        let pdf: any
        try {
          ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl
          const taskUrl = pdfjsLib.getDocument({ url: item.url, disableWorker: true })
          pdf = await taskUrl.promise
        } catch (e1) {
          // Fallback: use a fresh ArrayBuffer copy
          let data: Uint8Array
          if (item.data) {
            data = new Uint8Array(item.data.buffer.slice(0))
          } else {
            const res = await fetch(item.url)
            const ab = await res.arrayBuffer()
            data = new Uint8Array(ab.slice(0))
          }
          ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl
          const taskData = pdfjsLib.getDocument({ data, disableWorker: true })
          pdf = await taskData.promise
        }
        if (aborted) return
        pdfDocRef.current = pdf
        setViewer(v => ({ ...v, pageCount: pdf.numPages, page: Math.min(v.page, pdf.numPages || 1) }))
        setViewerRenderKey(k => k + 1)
        setViewerError(null)
      } catch (err: any) {
        setViewerError(err?.message || String(err))
      }
    }
    load()
    return () => { aborted = true }
  }, [viewer.open, viewer.item])

  useEffect(() => {
    const render = async () => {
      if (!viewer.open || viewer.item?.type !== 'pdf') return
      const pdf = pdfDocRef.current
      if (!pdf) return
      const containerEl = viewerContainerRef.current
      const pagesEl = pagesWrapRef.current
      if (!containerEl || !pagesEl) return
      try {
        pagesEl.innerHTML = ''
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const baseVp = page.getViewport({ scale: 1 })
          const rect = containerEl.getBoundingClientRect()
          const maxWidth = Math.max(50, rect.width || containerEl.clientWidth || 800)
          const scale = Math.max(0.1, Math.min(4, maxWidth / baseVp.width))
          const vp = page.getViewport({ scale })
          const ratio = window.devicePixelRatio || 1
          const canvas = document.createElement('canvas')
          canvas.style.maxWidth = '100%'
          canvas.style.height = 'auto'
          canvas.width = vp.width * ratio
          canvas.height = vp.height * ratio
          const ctx = canvas.getContext('2d')!
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
          await page.render({ canvasContext: ctx, viewport: vp }).promise
          pagesEl.appendChild(canvas)
        }
      } catch (err: any) {
        setViewerError(err?.message || String(err))
      }
    }
    render()
  }, [viewer.open, viewer.item, viewerRenderKey])

  useEffect(() => {
    if (!viewer.open || viewer.item?.type !== 'pdf') return
    const el = viewerContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setViewerRenderKey(k => k + 1)
    })
    ro.observe(el)
    return () => { try { ro.disconnect() } catch {} }
  }, [viewer.open, viewer.item])

  useEffect(() => {
    if (!allOpen) return
    let aborted = false
    const load = async () => {
      for (const it of items) {
        if (aborted) return
        if (it.type !== 'pdf') continue
        if (allPdfDocsRef.current.has(it.id)) continue
        try {
          ;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl
          let pdf: any
          try {
            const taskUrl = pdfjsLib.getDocument({ url: it.url, disableWorker: true })
            pdf = await taskUrl.promise
          } catch {
            let data: Uint8Array
            if (it.data) {
              data = new Uint8Array(it.data.buffer.slice(0))
            } else {
              const res = await fetch(it.url)
              const ab = await res.arrayBuffer()
              data = new Uint8Array(ab.slice(0))
            }
            const taskData = pdfjsLib.getDocument({ data, disableWorker: true })
            pdf = await taskData.promise
          }
          if (aborted) return
          allPdfDocsRef.current.set(it.id, pdf)
          setAllRenderKey(k => k + 1)
        } catch {}
      }
    }
    load()
    return () => { aborted = true }
  }, [allOpen, items])

  useEffect(() => {
    const render = async () => {
      if (!allOpen) return
      const container = allContainerRef.current
      if (!container) return
      for (const it of items) {
        if (it.type !== 'pdf') continue
        const pdf = allPdfDocsRef.current.get(it.id)
        if (!pdf) continue
        const target = container.querySelector(`[data-pdf-container="${it.id}"]`) as HTMLDivElement | null
        if (!target) continue
        target.innerHTML = ''
        const rect = target.getBoundingClientRect()
        const maxWidth = Math.max(50, rect.width || target.clientWidth || 800)
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i)
          const baseVp = page.getViewport({ scale: 1 })
          const scale = Math.max(0.1, Math.min(4, maxWidth / baseVp.width))
          const vp = page.getViewport({ scale })
          const ratio = window.devicePixelRatio || 1
          const canvas = document.createElement('canvas')
          canvas.style.maxWidth = '100%'
          canvas.style.height = 'auto'
          canvas.width = vp.width * ratio
          canvas.height = vp.height * ratio
          const ctx = canvas.getContext('2d')!
          ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
          await page.render({ canvasContext: ctx, viewport: vp }).promise
          target.appendChild(canvas)
        }
      }
    }
    render()
  }, [allOpen, items, allRenderKey])

  useEffect(() => {
    if (!allOpen) return
    const el = allContainerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setAllRenderKey(k => k + 1)
    })
    ro.observe(el)
    return () => { try { ro.disconnect() } catch {} }
  }, [allOpen])

  const content = useMemo(() => (
    <div className="asset-list" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${gridMin}px, 1fr))` }}>
      {items.map(it => (
        <div className="asset-item" key={it.id} onClick={() => onOpenItem(it)} style={{ cursor: 'pointer' }}>
          <div className="asset-thumb">
            {it.type === 'image' ? (
              <img src={it.url} />
            ) : (
              <img src={it.thumbUrl} />
            )}
          </div>
          <div className="asset-name">{it.name}</div>
        </div>
      ))}
    </div>
  ), [items, gridMin, onOpenItem])

  return (
    <div className="asset-pane" ref={paneRef} onDrop={onDrop} onDragOver={onDragOver}>
      <div className="asset-toolbar" style={{ display: 'grid', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={onPickImages}>Nhập ảnh</button>
          <button className="btn" onClick={onPickPdfs}>Nhập PDF</button>
          <input ref={imagesInputRef} type="file" multiple accept="image/*" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
          <input ref={pdfInputRef} type="file" multiple accept="application/pdf,.pdf" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={onPickExcel} disabled={!quoteId || excelBusy}>Nhập Excel</button>
          {excelBusy && <div style={{ color: '#d1d5db' }}>Đang nhập Excel...</div>}
          <input ref={excelInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={e => handleExcelFiles(e.target.files)} />
        </div>
      </div>
      <div className="asset-dropzone">
        <div>Kéo thả ảnh/PDF vào đây</div>
      </div>
      {content}
      {items.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
          <button className="btn" onClick={() => setAllOpen(true)}>Mở tất cả</button>
        </div>
      )}

      {viewer.open && viewer.item && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onCloseViewer}>
          <div style={{ width: 'min(92vw, 1000px)', height: '80vh', maxHeight: '90vh', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()} ref={viewerContainerRef}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{viewer.item.name}</div>
              <button className="btn ghost" onClick={onCloseViewer}>Đóng</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              {viewer.item.type === 'image' ? (
                <img src={viewer.item.url} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block', margin: '0 auto' }} />
              ) : viewerError ? (
                <div style={{ color: '#fca5a5' }}>Lỗi khi hiển thị PDF: {viewerError}</div>
              ) : !pdfDocRef.current ? (
                <div style={{ color: '#d1d5db' }}>Đang tải PDF...</div>
              ) : (
                <div ref={pagesWrapRef} style={{ display: 'grid', gap: 12, justifyItems: 'center' }} />
              )}
            </div>
          </div>
        </div>
      )}

      {allOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onCloseAll}>
          <div style={{ width: 'min(95vw, 1200px)', height: '85vh', maxHeight: '95vh', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()} ref={allContainerRef}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Xem tất cả</div>
              <button className="btn ghost" onClick={onCloseAll}>Đóng</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
              <div style={{ display: 'grid', gap: 16 }}>
                {items.map(it => (
                  it.type === 'image' ? (
                    <div key={it.id} style={{ display: 'grid', justifyItems: 'center' }}>
                      <img src={it.url} style={{ maxWidth: '100%', height: 'auto' }} />
                      <div style={{ color: '#d1d5db', marginTop: 4 }}>{it.name}</div>
                    </div>
                  ) : (
                    <div key={it.id}>
                      <div style={{ color: '#d1d5db', margin: '8px 0' }}>{it.name}</div>
                      <div data-pdf-container={it.id} style={{ display: 'grid', gap: 12, justifyItems: 'center' }}></div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
