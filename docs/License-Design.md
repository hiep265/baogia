# Thiết kế License + HWID

## 1) Mục tiêu
- Bảo vệ bản quyền phần mềm bán theo lần cài đặt.
- Hoạt động offline: app chỉ cần license hợp lệ khớp HWID.

## 2) Cấu trúc license
- Định dạng JSON, ký số bằng Ed25519 (Detached signature). Ứng dụng nhúng public key, server giữ private key.
```json
{
  "license_id": "LIC-2025-000123",
  "customer": "CTY ABC",
  "product": "BaoGiaPro/Win",
  "plan": "perpetual",
  "exp": null,
  "hwid_hash": "K3F5-7X98-...-PQ",
  "issued_at": 1730600000,
  "sig": "base64(ed25519_signature)"
}
```
- `hwid_hash` = Base32(SHA-256(concat(machine_fingerprint)));
- `machine_fingerprint` gồm: `MachineGuid`, BIOS serial, volume serial (đã chuẩn hoá lowercase, không khoảng trắng).

## 3) Quy trình kích hoạt
- App hiển thị `HWID` → khách gửi cho bạn.
- Server phát hành license gắn `hwid_hash` và ký số → gửi cho khách.
- App dán license → verify chữ ký bằng public key và so khớp HWID → lưu vào DB.

## 4) Verify trong app
- Khi khởi động, nếu chưa có license hoặc verify fail → chặn vào app, hiển thị màn hình kích hoạt.
- Định kỳ (mỗi 24h) re-verify license từ DB để chống chỉnh tay.

## 5) License server (đề xuất)
- Stack: Node/Express + better-sqlite3 (hoặc PostgreSQL).
- Endpoints tối thiểu:
  - POST `/issue` {customer, product, plan, exp, hwid_hash} → license JSON + sig
  - GET `/public-key` → public key
  - POST `/revoke` {license_id}
- Bảng: `licenses(id, customer, product, plan, exp, hwid_hash, issued_at, revoked)`

## 6) Chính sách
- Cho phép đổi máy tối đa N lần (support manual). Revoke license cũ khi cấp lại.
- Tuỳ chọn online-check: app gọi về server để kiểm tra revoke (bản sau).

## 7) Thực thi
- Thư viện: `tweetnacl` hoặc `libsodium` (verify Ed25519); `systeminformation` đọc phần cứng; `node:crypto` SHA-256.
- Lưu license nguyên bản trong `settings` hoặc bảng `license`.
