import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'
;(pdfjsLib as any).GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type Item = { id: string; name: string; type: 'image' | 'pdf'; url: string; thumbUrl?: string; pageCount?: number; data?: Uint8Array }

export default function AssetPane() {
  const [items, setItems] = useState<Item[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)
  const paneRef = useRef<HTMLDivElement | null>(null)
  const [gridMin, setGridMin] = useState<number>(120)

  const viewerContainerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pdfDocRef = useRef<any>(null)
  const [viewer, setViewer] = useState<{ open: boolean; item?: Item; page: number; pageCount?: number }>({ open: false, page: 1 })
  const [viewerError, setViewerError] = useState<string | null>(null)
  const [viewerRenderKey, setViewerRenderKey] = useState(0)

  const onPick = useCallback(() => {
    inputRef.current?.click()
  }, [])

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

  const prevPage = useCallback(() => {
    setViewer(v => {
      if (v.item?.type !== 'pdf') return v
      const p = Math.max(1, v.page - 1)
      return { ...v, page: p }
    })
  }, [])

  const nextPage = useCallback(() => {
    setViewer(v => {
      if (v.item?.type !== 'pdf') return v
      const max = v.pageCount || v.page
      const p = Math.min(max, v.page + 1)
      return { ...v, page: p }
    })
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
      const container = viewerContainerRef.current
      const canvas = canvasRef.current
      if (!container || !canvas) return
      try {
        const page = await pdf.getPage(viewer.page)
        const baseVp = page.getViewport({ scale: 1 })
        const rect = container.getBoundingClientRect()
        const maxWidth = Math.max(50, rect.width || container.clientWidth || 800)
        const scale = Math.max(0.1, Math.min(4, maxWidth / baseVp.width))
        const vp = page.getViewport({ scale })
        const ratio = window.devicePixelRatio || 1
        canvas.width = vp.width * ratio
        canvas.height = vp.height * ratio
        const ctx = canvas.getContext('2d')!
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
        await page.render({ canvasContext: ctx, viewport: vp }).promise
      } catch (err: any) {
        setViewerError(err?.message || String(err))
      }
    }
    render()
  }, [viewer.open, viewer.item, viewer.page, viewerRenderKey])

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
      <div className="asset-toolbar">
        <button className="btn" onClick={onPick}>Chọn tệp</button>
        <input ref={inputRef} type="file" multiple accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      </div>
      <div className="asset-dropzone">
        <div>Kéo thả ảnh/PDF vào đây</div>
      </div>
      {content}

      {viewer.open && viewer.item && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }} onClick={onCloseViewer}>
          <div style={{ width: 'min(92vw, 1000px)', height: '80vh', maxHeight: '90vh', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()} ref={viewerContainerRef}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <div style={{ fontWeight: 600, flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{viewer.item.name}</div>
              {viewer.item.type === 'pdf' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="btn" onClick={prevPage}>Trang trước</button>
                  <div style={{ color: '#d1d5db' }}>Trang {viewer.page}/{viewer.pageCount || '?'}</div>
                  <button className="btn" onClick={nextPage}>Trang sau</button>
                </div>
              )}
              <button className="btn ghost" onClick={onCloseViewer}>Đóng</button>
            </div>
            <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', overflow: 'auto' }}>
              {viewer.item.type === 'image' ? (
                <img src={viewer.item.url} style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
              ) : viewerError ? (
                <div style={{ color: '#fca5a5' }}>Lỗi khi hiển thị PDF: {viewerError}</div>
              ) : !pdfDocRef.current ? (
                <div style={{ color: '#d1d5db' }}>Đang tải PDF...</div>
              ) : (
                <canvas ref={canvasRef} style={{ maxWidth: '100%', height: 'auto' }} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
