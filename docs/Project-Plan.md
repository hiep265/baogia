# Kế hoạch triển khai (MVP ~ 3 tuần)

## Tuần 1
- Khởi tạo skeleton (Electron + React + TS + Vite + electron-builder).
- Import ảnh/PDF: pdf.js thumbnails, chọn trang.
- Crop workspace: pan/zoom + overlay nhiều khung, nút `X`, auto-add item, tạo thumbnail.
- DB schema + lưu quote/items + FileStore.

## Tuần 2
- Quote table tuỳ biến cột + inline edit + tính tổng hợp.
- Hiệu chuẩn kích thước; tính diện tích thực.
- Import Excel (xlsx/csv): mapping UI, validate, insert.
- History autosave + danh sách lịch sử + restore/clone.

## Tuần 3
- Xuất PDF từ template (logo, điều khoản, thumbnail tuỳ chọn).
- License + HWID: màn kích hoạt, verify Ed25519, lưu license.
- Đóng gói Windows (NSIS), ASAR, (tuỳ chọn) code signing.
- QA: ảnh lớn/PDF nhiều trang, hiệu năng overlay, kiểm thử license, tính đúng giá.

## Mốc bàn giao
- v0.1: Import + crop + auto-add + bảng báo giá cơ bản + PDF + license.
- v0.2: Excel import + lịch sử + tuỳ biến bảng nâng cao.

## Rủi ro/chặn
- PDF nặng nhiều trang → cần lazy render + cache thumbnail.
- Ảnh cực lớn → downscale preview, xử lý cắt qua canvas offscreen.
- HWID thay đổi sau cài lại Windows → chính sách cấp lại license.

## Tiêu chí Done
- Pass toàn bộ Acceptance trong PRD.
- Build Windows chạy độc lập, không cần cài thêm.
- Tài liệu hướng dẫn sử dụng cơ bản.
