# PRD — Ứng dụng Báo Giá (Windows/Electron)

## 1) Mục tiêu
- Tạo báo giá nhanh từ ảnh/PDF bằng cách đánh dấu nhiều vùng (multi-crop). Mỗi vùng trở thành 1 dòng (row) trong bảng tính tự động.
- Giao diện bảng tính (Excel-like) với cột/ô động và công thức; nhập/xuất Excel; xuất PDF đẹp.
- Lưu lịch sử báo giá để tái sử dụng. Bảo vệ bản quyền bằng License + HWID (offline verify).

## 2) Phạm vi (MVP)
- Import: ảnh (png/jpg/jpeg/webp), PDF nhiều trang (render thumbnail trang, chọn trang để xử lý).
- Màn hình crop: xem ảnh/phóng to/thu nhỏ; vẽ nhiều khung chữ nhật; có nút `X` trên mỗi khung để xoá; auto-add 1 row vào bảng tính ngay khi tạo khung.
- Bảng báo giá dạng bảng tính: cột/ô động; chỉnh sửa trực tiếp; hỗ trợ công thức (HyperFormula) cho các phép tính phổ biến.
- Hiệu chuẩn kích thước thực (pixel → mm/cm/m²) bằng đoạn chuẩn người dùng nhập.
- Import/Export Excel qua SheetJS (xlsx): giữ được công thức (formula strings) và giá trị; có mapping cột nếu cần ghép dữ liệu bên ngoài.
- Lịch sử báo giá: autosave mỗi thay đổi; màn hình lịch sử; khôi phục/clone.
- Xuất PDF: template đơn giản (logo, thông tin công ty, điều khoản, chữ ký).
- License + HWID: kích hoạt offline bằng license key/file, kiểm tra chữ ký + HWID.
- Lưu trữ: DB schema-less cho bảng báo giá (workbook JSON); liên kết vùng crop ↔ row qua `row_uid`.

Ngoài MVP (bản sau): crop đa giác, nhận diện vật thể tự động, đồng bộ cloud, auto-update.

## 3) Persona & Use cases
- Nhân viên kinh doanh/xưởng: cần báo giá nhanh từ ảnh bản vẽ hoặc PDF kỹ thuật.
- Use cases:
  - UC1: Import PDF nhiều trang, chọn trang, multi-crop, auto-add → chỉnh giá → xuất PDF.
  - UC2: Import ảnh, hiệu chuẩn kích thước, multi-crop → đặt đơn giá theo diện tích → xuất PDF.
  - UC3: Import Excel bảng vật tư → map cột → thêm/ghép vào báo giá hiện tại.
  - UC4: Mở lịch sử gần đây → clone thành báo giá mới.
  - UC5: Kích hoạt license offline trên máy mới.

## 4) Yêu cầu chức năng chi tiết
- Import tệp
  - Hỗ trợ: .png .jpg .jpeg .webp .pdf
  - PDF: render thumbnail nhanh; chọn trang; lazy render trang khi mở crop.
  - Drag & drop hoặc nút chọn file; nhiều file cùng lúc.
- Multi-crop với overlay
  - Vẽ khung chữ nhật; hiển thị khung với tay cầm resize; nút `X` để xoá.
  - Auto-add: khi thả chuột (kết thúc vẽ) tạo ngay 1 dòng (row) trong bảng tính, sinh `row_uid` và link với vùng crop.
  - Lưu toạ độ khung theo tỷ lệ (0..1) để tái mở và chỉnh sửa.
  - Cho phép đặt tên mặc định (ví dụ: Item 1, Item 2) và chỉnh sửa inline sau đó.
- Bảng tính (Spreadsheet)
  - Cột động, đổi thứ tự, ẩn/hiện; định dạng số (0/0.0/0.00), đơn vị (mm/cm/m²), tiền tệ.
  - Công thức HyperFormula: SUM, AVERAGE, IF, ROUND, VLOOKUP/INDEX+MATCH, v.v. (phạm vi hỗ trợ do license/khả năng engine).
  - Tự tính: diện tích từ crop (sau hiệu chuẩn), thành tiền, tổng, VAT, giảm giá, theo công thức.
  - Nhiều sheet đồng thời: thêm/xoá/đổi tên/sắp xếp, chọn sheet hoạt động; hỗ trợ công thức tham chiếu chéo sheet.
- Hiệu chuẩn kích thước
  - Người dùng vẽ đoạn chuẩn và nhập chiều dài thực (vd 1000 mm) → tính scale pixel→mm.
- Excel
  - Import/Export .xlsx bằng SheetJS, giữ công thức (string) và cached value (nếu có).
  - Mapping cột (khi ghép thêm dữ liệu): lưu mapping để dùng lại; validate số, bắt buộc, đơn vị.
- Lịch sử báo giá
  - Autosave mỗi thay đổi quan trọng (thêm/xoá/sửa item, cấu hình bảng).
  - Danh sách lịch sử theo thời gian; xem preview; khôi phục/clone thành báo giá mới.
- Xuất PDF
  - Template có logo, thông tin công ty, khách hàng, bảng chi tiết, tổng kết, điều khoản, chữ ký.
  - Tuỳ chọn kèm thumbnail vật thể.
- License + HWID
  - Màn hình kích hoạt hiển thị HWID; dán license hoặc chọn file; verify chữ ký và khớp HWID.
  - Nếu chưa kích hoạt → chỉ vào màn hình kích hoạt.

## 5) Yêu cầu phi chức năng
- Nền tảng: Windows 10/11 x64.
- Offline-first; không yêu cầu internet để dùng sau khi kích hoạt.
- Hiệu năng: mở ảnh lớn (tới ~8000×8000 px) và PDF đến 50 trang mượt; UI 60fps khi pan/zoom.
- Bền vững dữ liệu: autosave, tránh mất dữ liệu khi crash; file lưu trong AppData.
- Bảo mật & giấy phép: contextIsolation, IPC an toàn, license verify Ed25519, đóng gói ASAR.
- Tuân thủ giấy phép thư viện (AG Grid/Handsontable, HyperFormula, SheetJS) cho phần mềm thương mại.

## 6) Tiêu chí chấp nhận (Acceptance)
- Import PDF/ảnh nhiều tệp; chọn trang; render thumbnail < 200ms/trang (trên máy văn phòng phổ biến).
- Vẽ/xoá khung mượt; mỗi khung tạo ra 1 row tự động; xoá row từ overlay hoặc bảng.
- Spreadsheet cho phép chỉnh sửa, thêm/xoá cột/row; công thức được tính lại đúng với HyperFormula cho các hàm đã hỗ trợ.
- Quản lý nhiều sheet: có thể thêm/xoá/đổi tên/sắp xếp sheet; công thức cross-sheet hoạt động đúng; chuyển sheet hoạt động khi auto-add từ crop.
- Import Excel: hiển thị được sheet chính với công thức; giữ formula strings; tính lại kết quả tương thích; cảnh báo các công thức không hỗ trợ.
- Lịch sử hiển thị đầy đủ, khôi phục/clone hoạt động đúng.
- Xuất PDF trùng khớp template; có thumbnail nếu bật.
- License bắt buộc để vào app; HWID sai → từ chối.

## 7) Phụ thuộc & thư viện chính
- Electron, React + Vite + TS, cropper.js, pdfjs-dist, better-sqlite3.
- Spreadsheet: AG Grid Community; HyperFormula; SheetJS (xlsx).
- Xuất PDF: webContents.printToPDF (render từ HTML template).

## 8) Ràng buộc và giả định
- Crop chữ nhật cho MVP; đa giác xem xét bản sau.
- Giá tính theo công thức trong spreadsheet: diện tích (m²) hoặc đơn chiếc; có hiệu chuẩn.
- Người dùng có logo/thông tin công ty để cấu hình template PDF.
