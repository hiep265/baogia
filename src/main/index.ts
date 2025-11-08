import { app, BrowserWindow, shell, ipcMain } from 'electron'
import path from 'node:path'
import { initDb } from './db'
import * as WB from './workbook'
import * as Quotes from './quotes'

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  const devUrl = process.env.VITE_DEV_SERVER_URL
  if (devUrl) {
    win.loadURL(devUrl)
    win.webContents.openDevTools({ mode: 'detach' })
  } else {
    win.loadFile(path.resolve(__dirname, '../../dist/index.html'))
  }

  win.webContents.setWindowOpenHandler(({ url }: { url: string }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

function registerIpc() {
  ipcMain.handle('workbook.getLatest', (_evt, quoteId: number) => WB.getLatest(quoteId))
  ipcMain.handle('workbook.patch', (_evt, quoteId: number, payload: { ops: WB.PatchOp[] }) => WB.patch(quoteId, payload.ops))
  ipcMain.handle('workbook.recalc', (_evt, quoteId: number) => WB.recalc(quoteId))
  ipcMain.handle('workbook.sheets.list', (_evt, quoteId: number) => WB.sheetsList(quoteId))
  ipcMain.handle('workbook.sheets.add', (_evt, quoteId: number, name: string) => WB.sheetsAdd(quoteId, name))
  ipcMain.handle('workbook.sheets.rename', (_evt, quoteId: number, oldName: string, newName: string) => WB.sheetsRename(quoteId, oldName, newName))
  ipcMain.handle('workbook.sheets.remove', (_evt, quoteId: number, name: string) => WB.sheetsRemove(quoteId, name))
  ipcMain.handle('workbook.sheets.reorder', (_evt, quoteId: number, order: string[]) => WB.sheetsReorder(quoteId, order))
  ipcMain.handle('workbook.sheets.setActive', (_evt, quoteId: number, name: string) => WB.sheetsSetActive(quoteId, name))
  ipcMain.handle('ping', async () => 'pong')
  ipcMain.handle('quotes.ensureDefault', () => Quotes.ensureDefault())
}

app.whenReady().then(() => {
  initDb()
  registerIpc()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
