import { useCallback } from 'react'

type Props = {
  quoteId: number
  sheets: string[]
  active?: string | null
  onChanged: () => void
}

export default function SheetTabs({ quoteId, sheets, active, onChanged }: Props) {
  const setActive = useCallback(async (name: string) => {
    await window.api.workbook.sheets.setActive(quoteId, name)
    onChanged()
  }, [quoteId, onChanged])

  const addSheet = useCallback(async () => {
    const name = prompt('Tên sheet mới', 'Sheet') || 'Sheet'
    await window.api.workbook.sheets.add(quoteId, name)
    onChanged()
  }, [quoteId, onChanged])

  const renameSheet = useCallback(async () => {
    if (!active) return
    const name = prompt('Đổi tên sheet', active) || active
    await window.api.workbook.sheets.rename(quoteId, active, name)
    onChanged()
  }, [quoteId, active, onChanged])

  const removeSheet = useCallback(async () => {
    if (!active) return
    if (!confirm('Xoá sheet hiện tại?')) return
    await window.api.workbook.sheets.remove(quoteId, active)
    onChanged()
  }, [quoteId, active, onChanged])

  const moveLeft = useCallback(async () => {
    if (!active) return
    const order = [...sheets]
    const idx = order.indexOf(active)
    if (idx > 0) {
      const [it] = order.splice(idx, 1)
      order.splice(idx - 1, 0, it)
      await window.api.workbook.sheets.reorder(quoteId, order)
      onChanged()
    }
  }, [quoteId, sheets, active, onChanged])

  const moveRight = useCallback(async () => {
    if (!active) return
    const order = [...sheets]
    const idx = order.indexOf(active)
    if (idx >= 0 && idx < order.length - 1) {
      const [it] = order.splice(idx, 1)
      order.splice(idx + 1, 0, it)
      await window.api.workbook.sheets.reorder(quoteId, order)
      onChanged()
    }
  }, [quoteId, sheets, active, onChanged])

  return (
    <div className="tabs">
      <div className="tabs-left">
        {sheets.map(name => (
          <button key={name} className={"tab" + (name === active ? " active" : "")} onClick={() => setActive(name)}>
            {name}
          </button>
        ))}
      </div>
      <div className="tabs-right">
        <button className="btn" onClick={addSheet}>Thêm</button>
        <button className="btn" onClick={renameSheet} disabled={!active}>Đổi tên</button>
        <button className="btn" onClick={moveLeft} disabled={!active}>◀</button>
        <button className="btn" onClick={moveRight} disabled={!active}>▶</button>
        <button className="btn danger" onClick={removeSheet} disabled={!active}>Xoá</button>
      </div>
    </div>
  )
}
