import { useCallback, useMemo, useRef, useState } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
const pdfWorkerUrl = new URL('pdfjs-dist/build/pdf.worker.min.js', import.meta.url).toString()
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl

type Item = { id: string; name: string; type: 'image' | 'pdf'; url: string; thumbUrl?: string }

export default function AssetPane() {
  const [items, setItems] = useState<Item[]>([])
  const inputRef = useRef<HTMLInputElement | null>(null)

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
        const loadingTask = pdfjsLib.getDocument({ data: buf })
        const pdf = await loadingTask.promise
        const page = await pdf.getPage(1)
        const vp = page.getViewport({ scale: 0.4 })
        const canvas = document.createElement('canvas')
        canvas.width = vp.width
        canvas.height = vp.height
        const ctx = canvas.getContext('2d')!
        await page.render({ canvasContext: ctx, viewport: vp }).promise
        const thumbUrl = canvas.toDataURL('image/png')
        const blob = new Blob([buf], { type: 'application/pdf' })
        const url = URL.createObjectURL(blob)
        const it: Item = { id: Math.random().toString(36).slice(2), name: f.name, type: 'pdf', url, thumbUrl }
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

  const content = useMemo(() => (
    <div className="asset-list">
      {items.map(it => (
        <div className="asset-item" key={it.id}>
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
  ), [items])

  return (
    <div className="asset-pane" onDrop={onDrop} onDragOver={onDragOver}>
      <div className="asset-toolbar">
        <button className="btn" onClick={onPick}>Chọn tệp</button>
        <input ref={inputRef} type="file" multiple accept="image/*,.pdf" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      </div>
      <div className="asset-dropzone">
        <div>Kéo thả ảnh/PDF vào đây</div>
      </div>
      {content}
    </div>
  )
}
