# Task Breakdown — MVP

Ghi chú: Mỗi task đều có: mục tiêu, bước thực hiện, deliverables, acceptance, ước lượng, phụ thuộc. Thời lượng chỉ ước tính.

## 1) Skeleton dự án (Electron + React + TS + Vite + electron-builder)
- Mục tiêu: Khởi tạo bộ khung chạy được, đóng gói được.
- Bước:
  1. Tạo cấu trúc thư mục main/preload/renderer.
  2. Cấu hình Vite + React + TS, preload (contextIsolation), IPC channels.
  3. Thêm electron-builder (NSIS), cấu hình output, icon.
- Deliverables: chạy dev, build .exe thử được.
- Acceptance: chạy trên Windows 10/11; preload an toàn; hot reload.
- Ước lượng: 0.5–1 ngày.
- Phụ thuộc: none.

## 2) Module Workbook (schema-less, multi-sheet)
- Mục tiêu: Lưu/đọc `workbook_json` với versioning, hỗ trợ nhiều sheet.
- Bước:
  1. Tạo bảng `quote_workbooks`, model, repository.
  2. Định nghĩa JSON schema nội bộ (sheets, columns/rows/cells {t,v,f}, activeSheet).
  3. API `workbook.getLatest`, `workbook.patch`, `workbook.sheets.*`, `workbook.recalc`.
  4. Tích hợp HyperFormula: init từ workbook, map sheet index, recalc.
- Deliverables: module JS + test cơ bản.
- Acceptance: thêm/xoá/đổi tên/sắp xếp sheet; patch cell, recalc ok.
- Ước lượng: 1.5–2 ngày.
- Phụ thuộc: Skeleton.

## 3) Spreadsheet UI (AG Grid Community)
- Mục tiêu: Render nhiều sheet, chỉnh sửa ô, cột động, công thức.
- Bước:
  1. Tabs sheet: add/rename/reorder/delete, set active.
  2. Render AG Grid theo sheet active; map cell {t,v,f} ↔ grid.
  3. Sửa ô → patch workbook + recalc HyperFormula.
  4. Định dạng: số/tiền tệ/đơn vị; validate cơ bản.
- Deliverables: màn hình Spreadsheet hoạt động được.
- Acceptance: thêm/xoá cột/row, sửa ô, công thức tính đúng.
- Ước lượng: 2–3 ngày.
- Phụ thuộc: Module Workbook.

## 4) Import ảnh/PDF
- Mục tiêu: Import nhiều tệp ảnh/PDF; render thumbnails PDF; chọn trang.
- Bước:
  1. `files.openDialog` + drag&drop; lọc phần mở rộng.
  2. pdf.js render thumbnails, lazy load.
  3. Lưu `quote_assets` (type, path, page), hash file.
- Deliverables: danh sách file + thumbnails PDF.
- Acceptance: PDF 50 trang load ổn; ảnh lớn hiển thị mượt.
- Ước lượng: 1–1.5 ngày.
- Phụ thuộc: Skeleton.

## 5) Crop Workspace + Overlay
- Mục tiêu: Vẽ nhiều khung, auto-add row, nút X xoá.
- Bước:
  1. Canvas/cropper.js cho pan/zoom.
  2. Overlay React/konva quản lý nhiều khung (x,y,w,h normalized).
  3. Thả chuột → tạo `row_uid`, thêm row vào sheet active, lưu `quote_regions` + thumbnail.
  4. Nút X xoá: gỡ region và (tuỳ chọn) row tương ứng.
- Deliverables: màn hình crop hoạt động.
- Acceptance: vẽ/xoá mượt, auto-add row, link `row_uid` đúng.
- Ước lượng: 2–3 ngày.
- Phụ thuộc: Import ảnh/PDF, Module Workbook.

## 6) Hiệu chuẩn kích thước
- Mục tiêu: Chuyển pixel→mm/cm/m².
- Bước:
  1. Công cụ vẽ đoạn chuẩn + nhập chiều dài thực.
  2. Lưu scale vào workbook/settings; áp dụng tính diện tích cho row.
- Deliverables: module scale + UI đơn giản.
- Acceptance: diện tích tính đúng với sai số <2%.
- Ước lượng: 0.5–1 ngày.
- Phụ thuộc: Crop Workspace.

## 7) Excel Import/Export (SheetJS)
- Mục tiêu: Đọc/ghi .xlsx, giữ công thức string và values.
- Bước:
  1. Import nhiều sheet → chọn sheet chính → chuyển thành workbook JSON.
  2. Export workbook → .xlsx (giữ f và v).
  3. Mapping cột (tùy chọn) khi ghép dữ liệu.
- Deliverables: chức năng import/export.
- Acceptance: file mẫu mở đúng; công thức phổ biến giữ được, recalc ok.
- Ước lượng: 1–1.5 ngày.
- Phụ thuộc: Module Workbook, Spreadsheet UI.

## 8) History & Versioning
- Mục tiêu: Autosave snapshot; danh sách lịch sử; restore/clone.
- Bước:
  1. Lưu snapshot khi sự kiện lớn (import, crop, sửa hàng loạt).
  2. UI lịch sử: danh sách theo thời gian, xem preview tối giản.
  3. Restore/clone tạo quote mới từ snapshot.
- Deliverables: bảng lịch sử hoạt động.
- Acceptance: khôi phục chính xác; không mất dữ liệu.
- Ước lượng: 1 ngày.
- Phụ thuộc: Module Workbook.

## 9) PDF Export
- Mục tiêu: Xuất PDF từ HTML template.
- Bước:
  1. Template HTML (logo, thông tin công ty/khách hàng, bảng, điều khoản, chữ ký).
  2. Render sheet chính → HTML → `printToPDF`.
  3. Tuỳ chọn thumbnail vật thể trong bảng.
- Deliverables: file PDF đúng layout.
- Acceptance: số liệu khớp, layout ổn định.
- Ước lượng: 1 ngày.
- Phụ thuộc: Spreadsheet UI.

## 10) License + HWID
- Mục tiêu: Kích hoạt offline; verify chữ ký + HWID.
- Bước:
  1. Tạo màn hình kích hoạt (hiển thị HWID, dán/paste license JSON).
  2. Verify Ed25519 (public key nhúng) + so hwid_hash.
  3. Lưu license vào DB; chặn vào app nếu chưa kích hoạt.
- Deliverables: màn kích hoạt + service verify.
- Acceptance: kích hoạt thành công, sai HWID bị chặn.
- Ước lượng: 0.5–1 ngày.
- Phụ thuộc: Skeleton.

## 11) Đóng gói & QA
- Mục tiêu: Build NSIS, ASAR, test chức năng & hiệu năng.
- Bước:
  1. electron-builder cấu hình target win x64, icon, artifactName.
  2. QA: test ảnh lớn, PDF nhiều trang, crop, spreadsheet, Excel import/export, history, PDF export, license.
- Deliverables: bộ cài .exe.
- Acceptance: cài đặt/khởi chạy thành công trên Windows 10/11.
- Ước lượng: 1–1.5 ngày.
- Phụ thuộc: tất cả module chính.

## 12) Rủi ro & phương án
- PDF nặng: lazy render, cache thumbnails.
- Ảnh lớn: downscale preview, offscreen canvas.
- HyperFormula/AG Grid: giới hạn license/tính năng → fallback tính toán ứng dụng ở một số công thức.
- HWID thay đổi: chính sách cấp lại license.
