import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  ping: () => ipcRenderer.invoke('ping'),
  quotes: {
    ensureDefault: () => ipcRenderer.invoke('quotes.ensureDefault'),
  },
  workbook: {
    getLatest: (quoteId: number) => ipcRenderer.invoke('workbook.getLatest', quoteId),
    patch: (quoteId: number, payload: { ops: any[] }) => ipcRenderer.invoke('workbook.patch', quoteId, payload),
    recalc: (quoteId: number) => ipcRenderer.invoke('workbook.recalc', quoteId),
    sheets: {
      list: (quoteId: number) => ipcRenderer.invoke('workbook.sheets.list', quoteId),
      add: (quoteId: number, name: string) => ipcRenderer.invoke('workbook.sheets.add', quoteId, name),
      rename: (quoteId: number, oldName: string, newName: string) => ipcRenderer.invoke('workbook.sheets.rename', quoteId, oldName, newName),
      remove: (quoteId: number, name: string) => ipcRenderer.invoke('workbook.sheets.remove', quoteId, name),
      reorder: (quoteId: number, order: string[]) => ipcRenderer.invoke('workbook.sheets.reorder', quoteId, order),
      setActive: (quoteId: number, name: string) => ipcRenderer.invoke('workbook.sheets.setActive', quoteId, name),
    }
  }
} as any)
