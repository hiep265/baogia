import type { Dependency, IAccessor, ICommand } from '@univerjs/core'
import { CommandType, Disposable, Injector, Plugin, UniverInstanceType } from '@univerjs/core'
import type { IMenuButtonItem } from '@univerjs/ui'
import { ContextMenuGroup, ContextMenuPosition, IMenuManagerService, MenuItemType } from '@univerjs/ui'
import { ICommandService } from '@univerjs/core'

const PLUGIN_NAME = 'BAOGIA_MARK_COLUMN_PLUGIN'

export const MarkColumnOperationId = 'baogia.mark-target-column'
export const UnmarkColumnOperationId = 'baogia.unmark-target-column'

export const MarkColumnOperation: ICommand = {
  id: MarkColumnOperationId,
  type: CommandType.OPERATION,
  handler: async (_accessor: IAccessor) => {
    const w = (window as any)
    const univerAPI = w.__univer?.univerAPI
    if (!univerAPI) return false
    const fWorkbook = univerAPI.getActiveWorkbook()
    const fWorksheet = fWorkbook?.getActiveSheet?.()
    if (!fWorksheet) return false
    const fSelection = fWorksheet.getSelection?.()
    let colIndex = 0
    try {
      const { actualColumn } = fSelection?.getCurrentCell?.() || { actualColumn: 0 }
      colIndex = actualColumn
    } catch {}
    const sheetName = fWorksheet.getName?.() || ''
    try { fWorksheet.setColumnDefaultStyle(colIndex, { bg: { rgb: '#4338ca22' } }) } catch {}
    w.__baogiaTargetColumn = { sheetName, colIndex }
    return true
  },
}

export const UnmarkColumnOperation: ICommand = {
  id: UnmarkColumnOperationId,
  type: CommandType.OPERATION,
  handler: async (_accessor: IAccessor) => {
    const w = (window as any)
    const univerAPI = w.__univer?.univerAPI
    if (!univerAPI) return false
    const fWorkbook = univerAPI.getActiveWorkbook()
    const fWorksheet = fWorkbook?.getActiveSheet?.()
    if (!fWorksheet) return false
    const { sheetName, colIndex } = w.__baogiaTargetColumn || {}
    if (sheetName && typeof colIndex === 'number') {
      try { fWorksheet.setColumnDefaultStyle(colIndex, undefined) } catch {}
    }
    w.__baogiaTargetColumn = null
    return true
  },
}

function MarkColumnMenuFactory(): IMenuButtonItem<string> {
  return {
    id: MarkColumnOperationId,
    type: MenuItemType.BUTTON,
    tooltip: 'Đánh dấu cột để chèn ảnh',
    title: 'Đánh dấu cột nhận ảnh',
  }
}

function UnmarkColumnMenuFactory(): IMenuButtonItem<string> {
  return {
    id: UnmarkColumnOperationId,
    type: MenuItemType.BUTTON,
    tooltip: 'Bỏ đánh dấu cột',
    title: 'Bỏ đánh dấu cột',
  }
}

export class UniverSheetsMarkColumnPlugin extends Plugin {
  static override type = UniverInstanceType.UNIVER_SHEET
  static override pluginName = PLUGIN_NAME

  constructor(protected readonly _injector: Injector) { super() }

  override onStarting(): void {
    ;([
      [MarkColumnController],
    ] as Dependency[]).forEach((d) => this._injector.add(d))
  }

  override onRendered(): void {
    this._injector.createInstance(MarkColumnController)
  }
}

export class MarkColumnController extends Disposable {
  private readonly _commandService: ICommandService
  private readonly _menuManagerService: IMenuManagerService

  constructor(private readonly _injector: Injector) {
    super()
    this._commandService = this._injector.get(ICommandService)
    this._menuManagerService = this._injector.get(IMenuManagerService)
    this._initCommands()
    this._initMenus()
  }

  private _initCommands(): void {
    ;[
      MarkColumnOperation,
      UnmarkColumnOperation,
    ].forEach((c) => this.disposeWithMe(this._commandService.registerCommand(c)))
  }

  private _initMenus(): void {
    this._menuManagerService.mergeMenu({
      [ContextMenuPosition.MAIN_AREA]: {
        [ContextMenuGroup.OTHERS]: {
          [MarkColumnOperationId]: { order: 10, menuItemFactory: MarkColumnMenuFactory },
          [UnmarkColumnOperationId]: { order: 11, menuItemFactory: UnmarkColumnMenuFactory },
        },
      },
    })
  }
}
