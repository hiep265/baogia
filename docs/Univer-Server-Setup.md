# Univer Server (Preset Mode) - Hướng dẫn nhanh

Univer Advanced Preset yêu cầu backend Universer để xử lý Import/Export .xlsx. Dưới đây là cách dựng nhanh môi trường local.

## 1) Cài & chạy Univer Server bằng script nhanh

Script này sẽ cài Docker (nếu chưa có), tải image và khởi chạy stack Universer + Exchange.

```bash
bash -c "$(curl -fsSL https://get.univer.ai)"
```

Sau khi script hoàn tất, stack sẽ chạy với các dịch vụ cần thiết. Bạn có thể xem log:

```bash
docker compose logs -f universer --since 10m
docker compose logs -f univer-worker-exchange --since 10m
```

## 2) Xác nhận endpoint

Mặc định client đang dùng endpoint:

```
VITE_UNIVERSER_ENDPOINT=http://localhost:3010
```

Bạn có thể đổi trong `src/renderer/.env.local`.

Các API cần thấy OK:

- POST {UNIVERSER}/universer-api/stream/file/upload
- POST {UNIVERSER}/universer-api/exchange/{type}/import
- GET  {UNIVERSER}/universer-api/exchange/task/{taskID}

## 3) Cấu hình client

Đã có sẵn trong mã nguồn:

- `UniverSheetsAdvancedPreset({ universerEndpoint })`
- `window.__univer.univerAPI` để `AssetPane` gọi `importXLSXToSnapshotAsync`.

Bạn chỉ cần set biến môi trường và khởi động lại app.

## 4) Cài dependency và chạy app

Tại thư mục dự án:

```bash
# chọn một trong các lệnh phù hợp môi trường của bạn
npm i
# hoặc
pnpm i
# hoặc
yarn

# dev
npm run dev
```

Nếu máy chưa có npm:

```bash
sudo apt install npm
```

## 5) Kiểm thử

- Mở app, mở màn hình sổ tính.
- Nhấn "Nhập Excel" và chọn file .xlsx.
- Khi Universer hoạt động: dữ liệu import qua server, tạo sheet và kích hoạt sheet cuối.
- Nếu tắt server: chức năng tự động fallback về parser `xlsx` local.

## 6) Ghi chú

- Nếu có license thương mại: cấu hình theo hướng dẫn "Using License in Client" của Univer.
- Nếu muốn bật tính năng tính toán công thức phía server khi export: cần bật `SSC_SERVER_ENABLED=true` ở server.
- Muốn chuyển sang Plugin Mode (`@univerjs-pro/exchange-client`)? Hãy yêu cầu, mình sẽ cấu hình theo hướng đó.
