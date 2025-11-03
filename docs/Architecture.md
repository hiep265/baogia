# Kiến trúc kỹ thuật

## 1) Tổng quan
- Ứng dụng Electron (Main/Preload/Renderer) + React + TypeScript + Vite.
- DB cục bộ: better-sqlite3 (Main). Ảnh/thumbnail lưu file trong AppData.
- Import ảnh/PDF trong Renderer (pdfjs-dist), crop overlay tuỳ biến kết hợp cropper.js.
- Giao diện bảng tính (Excel-like) với AG Grid Community + HyperFormula (engine công thức) + SheetJS (đọc/ghi Excel).
- IPC an toàn qua Preload (contextIsolation: true, nodeIntegration: false).

## 2) Các mô-đun chính
- Main process
  - WindowManager, AppPaths, DB (SQLite), FileStore (lưu ảnh/thumbnail), LicenseService, PdfExportService.
- Preload
  - Expose API có kiểm soát: `files`, `db`, `license`, `pdfExport`, `history`, `excel`, `settings`, `workbook`.
- Renderer (React)
  - Importer: chọn file, render PDF thumbnails, chọn trang.
  - Crop Workspace: pan/zoom (cropper.js) + overlay nhiều khung (React layer), nút `X` để xoá, auto-add (liên kết tới hàng trong workbook qua `row_uid`).
  - Spreadsheet (AG Grid Community): cột/ô động; nhiều sheet (thêm/xoá/đổi tên/sắp xếp, set active); công thức HyperFormula (cross-sheet); import Excel → giữ công thức; export Excel.
  - Excel Import: mapping UI (nếu nhập thêm dữ liệu), validate, preview.
  - History: danh sách phiên bản, restore/clone.
  - Settings: VAT, định dạng số, template PDF, hiệu chuẩn.

## 3) Luồng dữ liệu
- Import file → (Renderer) render/preview → người dùng vẽ khung → tạo `cropRegion` (relative 0..1) → auto-add một dòng trong workbook (gán `row_uid` vào sheet đang hoạt động) → lưu DB (Main) + lưu thumbnail tại FileStore → cập nhật workbook.
- Chỉnh sửa ô/công thức trong spreadsheet → patch workbook JSON (version mới) + HyperFormula recalc → autosave snapshot vào History.
- Export PDF → Renderer render HTML → Main `printToPDF` → lưu file.
- License → Renderer yêu cầu Preload `license.verify(licenseJson)` → Main verify Ed25519 + so HWID.

## 4) API IPC (đề xuất)
- `files.openDialog({filters})` → [paths]
- `pdf.renderThumbnails(path)` → [{page, thumbPath|ImageBitmap}]
- `images.saveCropped({sourcePath, page, rect, scale})` → {thumbPath}
- `db.quotes.create(data)` / `db.quotes.update(id, patch)` / `db.quotes.get(id)`
- `workbook.getLatest(quoteId)` → {version, workbook}
- `workbook.patch(quoteId, {ops})` → {version}
- `workbook.importExcel(quoteId, filePath)` → {version}
- `workbook.exportExcel(quoteId, filePath)` → {ok}
- `workbook.recalc(quoteId)` → {ok}
 - `workbook.sheets.list(quoteId)` → [names]
 - `workbook.sheets.add(quoteId, name)` → {version}
 - `workbook.sheets.rename(quoteId, oldName, newName)` → {version}
 - `workbook.sheets.remove(quoteId, name)` → {version}
 - `workbook.sheets.reorder(quoteId, order)` → {version}
 - `workbook.sheets.setActive(quoteId, name)` → {version}
- `history.snapshot(quoteId, reason)` / `history.list(quoteId)` / `history.restore(snapshotId)`
- `excel.import({file, mapping})` → {inserted, errors}
- `pdfExport.quote(quoteId, templateId)` → {pdfPath}
- `license.activate(licenseJson)` / `license.status()`

## 5) Multi-crop design
- Dùng cropper.js cho pan/zoom/canvas transform.
- Lớp overlay riêng (div/canvas/konva) quản lý nhiều khung: mỗi khung có toạ độ normalized theo ảnh gốc (0..1). Nhấp `X` xoá → xoá luôn dòng workbook tương ứng (qua `row_uid`).
- Tạo thumbnail bằng Canvas: cắt theo toạ độ thực tế sau khi tính transform (zoom/offset) và lưu qua Main/FileStore.

## 6) File & Thư mục lưu trữ
- AppData: `%AppData%/BaoGiaPro/`
  - `db.sqlite`
  - `images/YYYY/MM/DD/*.png`
  - `thumbs/YYYY/MM/DD/*.png`
  - `templates/`
  - `logs/`

## 7) Bảo mật & đóng gói
- Electron: contextIsolation, disable remote, CSP, chặn protocol lạ, chỉ allowlist kênh IPC.
- License: nhúng public key, verify chữ ký Ed25519.
- Đóng gói: electron-builder + NSIS; ASAR; code signing (nếu có chứng thư).

## 8) Công nghệ
- `electron`, `vite`, `react`, `typescript`
- `cropperjs` + overlay tự code
- `pdfjs-dist` (render PDF)
- `better-sqlite3` (DB)
- `ag-grid-community` (Spreadsheet UI)
- `hyperformula` (engine công thức) – lưu ý giấy phép thương mại cho phần mềm thương mại
- `xlsx` (SheetJS – đọc/ghi Excel)
- `systeminformation` (HWID)
