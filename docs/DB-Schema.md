# Sơ đồ dữ liệu (SQLite)

## 1) Nguyên tắc
- Lưu workbook báo giá dạng JSON (schema-less) để hỗ trợ cột động và công thức (giống Excel).
- Liên kết vùng crop ↔ hàng trong workbook qua `row_uid` hoặc `cell_range`, không cố định cột/field.
- Lưu lịch sử snapshot theo quote (JSON) để restore/clone.
- Lưu mapping import Excel để tái sử dụng.

## 2) Bảng & chỉ mục
```sql
-- quotes: thông tin báo giá
CREATE TABLE IF NOT EXISTS quotes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  company TEXT,
  tax_id TEXT,
  vat_rate REAL DEFAULT 0.1,
  discount_rate REAL DEFAULT 0,
  note TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_quotes_updated ON quotes(updated_at);

-- quote_workbooks: lưu workbook JSON linh hoạt (cột/ô/công thức động)
CREATE TABLE IF NOT EXISTS quote_workbooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  workbook_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_qw_quote_version ON quote_workbooks(quote_id, version);
CREATE INDEX IF NOT EXISTS idx_qw_updated ON quote_workbooks(updated_at);

-- quote_assets: tệp nguồn (ảnh/PDF) gắn với 1 quote
CREATE TABLE IF NOT EXISTS quote_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  type TEXT CHECK(type IN ('image','pdf')) NOT NULL,
  source_path TEXT NOT NULL,
  source_page INTEGER,
  hash TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_assets_quote ON quote_assets(quote_id);

-- quote_regions: vùng crop liên kết tới hàng/ô trong workbook
CREATE TABLE IF NOT EXISTS quote_regions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  asset_id INTEGER NOT NULL REFERENCES quote_assets(id) ON DELETE CASCADE,
  x REAL NOT NULL,  -- 0..1
  y REAL NOT NULL,  -- 0..1
  w REAL NOT NULL,  -- 0..1
  h REAL NOT NULL,  -- 0..1
  thumb_path TEXT,
  sheet_name TEXT,  -- nếu map theo địa chỉ
  row_uid TEXT,     -- nếu map theo hàng động
  cell_range TEXT,  -- nếu map theo vùng địa chỉ (A10:B10)
  meta_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_regions_quote ON quote_regions(quote_id);
CREATE INDEX IF NOT EXISTS idx_regions_asset ON quote_regions(asset_id);

-- settings: cấu hình chung (JSON)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT
);

-- license: lưu license JSON
CREATE TABLE IF NOT EXISTS license (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  license_json TEXT NOT NULL,
  activated_at INTEGER NOT NULL
);

-- quote_history: snapshot JSON theo thời gian
CREATE TABLE IF NOT EXISTS quote_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quote_id INTEGER NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  snapshot_json TEXT NOT NULL,
  reason TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_history_quote ON quote_history(quote_id, created_at DESC);

-- import_mappings: lưu mapping Excel
CREATE TABLE IF NOT EXISTS import_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  mapping_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

## 3) Gợi ý snapshot JSON
```json
{
  "workbook": {
    "version": 3,
    "sheets": [
      {
        "name": "Báo giá",
        "columns": [
          {"key": "A", "name": "Tên"},
          {"key": "B", "name": "Đơn giá"},
          {"key": "C", "name": "Số lượng"},
          {"key": "D", "name": "Thành tiền"}
        ],
        "rows": [
          {
            "uid": "row-01UQ8",
            "cells": {
              "A": {"t": "s", "v": "Vật thể 1"},
              "B": {"t": "n", "v": 250000},
              "C": {"t": "n", "v": 2},
              "D": {"t": "n", "f": "=B2*C2"}
            }
          }
        ],
        "meta": {"currency": "VND"}
      }
    ]
  },
  "regions": [
    {
      "asset_id": 15,
      "rect": {"x":0.12, "y":0.33, "w":0.2, "h":0.15},
      "row_uid": "row-01UQ8",
      "thumb_path": ".../thumbs/2025/11/03/..png"
    }
  ]
}
```

## 4) Truy vấn tham khảo
- Lấy workbook JSON mới nhất của 1 quote:
  - `SELECT workbook_json FROM quote_workbooks WHERE quote_id=? ORDER BY version DESC LIMIT 1`
- Lấy danh sách vùng crop theo quote (kèm asset):
  - `SELECT r.*, a.source_path, a.source_page FROM quote_regions r JOIN quote_assets a ON r.asset_id=a.id WHERE r.quote_id=? ORDER BY r.created_at`
- Lấy lịch sử mới nhất:
  - `SELECT * FROM quote_history WHERE quote_id=? ORDER BY created_at DESC LIMIT 1`
- Gợi ý: tính toán (tổng tiền, VAT, giảm giá) thực hiện ở tầng ứng dụng bằng HyperFormula/logic app để linh hoạt quy tắc làm tròn.
