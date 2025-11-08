export {}

declare global {
  type WorkbookCell = { t?: 'n'|'s'; v?: any; f?: string }
  type WorkbookRow = { uid: string; cells: Record<string, WorkbookCell> }
  type WorkbookSheet = { name: string; columns?: any[]; rows: WorkbookRow[] }
  type Workbook = { version: number; activeSheet?: string | null; sheets: WorkbookSheet[] }

  interface Window {
    api: {
      ping: () => Promise<string>
      quotes: {
        ensureDefault: () => Promise<number>
      }
      workbook: {
        getLatest: (quoteId: number) => Promise<{ version: number; workbook: Workbook }>
        patch: (quoteId: number, payload: { ops: Array<{ type: 'setCell'; sheet: string; row_uid: string; col: string; value?: any; t?: 'n'|'s'; f?: string } | { type: 'addRow'; sheet: string; row_uid: string } | { type: 'removeRow'; sheet: string; row_uid: string } | { type: 'addColumn'; sheet: string; col: string; name?: string } | { type: 'removeColumn'; sheet: string; col: string }> }) => Promise<{ version: number } | { error: string }>
        recalc: (quoteId: number) => Promise<{ version: number }>
        sheets: {
          list: (quoteId: number) => Promise<string[]>
          add: (quoteId: number, name: string) => Promise<{ version: number } | { error: string }>
          rename: (quoteId: number, oldName: string, newName: string) => Promise<{ version: number } | { error: string }>
          remove: (quoteId: number, name: string) => Promise<{ version: number } | { error: string }>
          reorder: (quoteId: number, order: string[]) => Promise<{ version: number }>
          setActive: (quoteId: number, name: string) => Promise<{ version: number } | { error: string }>
        }
      }
    }
  }
}
