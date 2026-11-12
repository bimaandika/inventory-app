# ERD — Versi Sederhana

> Status: **Disetujui** (12 November 2026)
> Dasar: dokumen di `docs/workflow/` (peran, Case 1, 2, 3, 3b, 4).
> Pendekatan: **ERD lama diperluas** — semua jenis transaksi memakai satu tabel header (`stock_movements`) dan satu tabel item (`stock_movement_items`), dibedakan lewat kolom `type`. Aturan per jenis dijaga di kode (backend).

## Diagram

```mermaid
erDiagram
  SITES ||--o{ USERS : "punya (admin pusat tanpa site)"
  SITES ||--o{ INVENTORIES : "memiliki"
  CATEGORIES ||--o{ INVENTORIES : "mengelompokkan"
  SITES ||--o{ SKU_SEQUENCES : "nomor urut SKU"
  USERS ||--o{ STOCK_MOVEMENTS : "membuat / peminta"
  SITES ||--o{ STOCK_MOVEMENTS : "site / site tujuan"
  STOCK_MOVEMENTS |o--o{ STOCK_MOVEMENTS : "parent: transaksi asal"
  STOCK_MOVEMENTS |o--o{ STOCK_MOVEMENT_ITEMS : "berisi (kosong = keranjang)"
  STOCK_MOVEMENT_ITEMS |o--o{ STOCK_MOVEMENT_ITEMS : "ref: item asal"
  INVENTORIES ||--o{ STOCK_MOVEMENT_ITEMS : "barang"
  USERS ||--o{ STOCK_MOVEMENT_ITEMS : "pemilik keranjang"
  STOCK_MOVEMENTS ||--o{ HISTORIES : "timeline"
  USERS ||--o{ HISTORIES : "pelaku"

  SITES {
    int id PK
    varchar name
    varchar code UK "GMG, POMS, GEG, FOL, TRK"
    timestamp created_at
    timestamp updated_at
  }
  USERS {
    int id PK
    varchar username UK
    varchar name "BARU: nama lengkap"
    varchar password
    enum role "BERUBAH: admin_pusat, admin, crew"
    int site_id FK "null hanya untuk admin_pusat"
    boolean is_active "BARU"
    timestamp created_at
    timestamp updated_at
  }
  CATEGORIES {
    int id PK
    varchar name UK
    timestamp created_at
    timestamp updated_at
  }
  INVENTORIES {
    int id PK
    varchar name "unik per site"
    varchar unit
    enum type "CONSUMABLE, NON_CONSUMABLE"
    text description
    int category_id FK
    int site_id FK "site pemilik"
    varchar sku UK
    varchar image
    int quantity "stok tersedia di site pemilik"
    boolean is_active "BARU"
    timestamp created_at
    timestamp updated_at
  }
  SKU_SEQUENCES {
    int site_id PK
    enum type PK
    int last_number
  }
  STOCK_MOVEMENTS {
    int id PK
    varchar number UK "format ditentukan Bima"
    enum type "BERUBAH: lihat daftar type"
    varchar status "nilai tergantung type"
    timestamp status_changed_at "BARU"
    int site_id FK "BARU: site utama transaksi"
    int to_site_id FK "BARU: site tujuan / peminjam"
    int parent_id FK "BARU: transaksi asal"
    int requester_id FK "BARU: crew peminta (REQUEST)"
    enum inventory_type "BARU: jenis barang (OPNAME)"
    varchar reason "alasan pilihan (REQUEST)"
    text remarks "teks bebas"
    int id_user FK "pembuat"
    timestamp created_at
    timestamp updated_at
  }
  STOCK_MOVEMENT_ITEMS {
    int id PK
    int movement_id FK "null = masih di keranjang"
    int id_user FK "pemilik keranjang"
    int inventory_id FK
    int dest_inventory_id FK "BARU: barang di site tujuan (TRANSFER)"
    int ref_item_id FK "BARU: item asal"
    int quantity
    int qty_approved "BARU"
    int qty_good "BARU"
    int qty_damaged "BARU"
    int qty_lost "BARU"
    int qty_used "BARU"
    int qty_before "BARU"
    int qty_after "BARU"
    varchar reason "BARU: alasan adjustment"
    text note "BARU"
    timestamp created_at
    timestamp updated_at
  }
  HISTORIES {
    int id PK
    int id_sm FK
    varchar action "CREATED, APPROVED, PICKED_UP, ..."
    varchar status "status setelah aksi"
    text remarks
    int id_user FK "pelaku"
    timestamp date
  }
```

## Jenis transaksi (`stock_movements.type`)

| `type` | Case | Status yang mungkin | `site_id` | `to_site_id` | `parent_id` |
|---|---|---|---|---|---|
| `REQUEST` | 1 — Permintaan | `PENDING`, `APPROVED`, `PICKED_UP`, `COMPLETED`, `REJECTED`, `CANCELLED` | site permintaan | — | — |
| `RETURN` | 1 — Pengembalian | `SUBMITTED`, `CONFIRMED`, `CANCELLED` | site permintaan | — | `REQUEST` asal |
| `GOODS_IN` | 2 — Barang masuk | `COMPLETED` | site penerima | — | — |
| `TRANSFER` | 3 — Pemindahan | `IN_TRANSIT`, `COMPLETED`, `CANCELLED` | site asal | site tujuan | `LOAN` asal *(jika dari "jadikan permanen")* |
| `LOAN` | 3b — Peminjaman | `IN_TRANSIT`, `BORROWED`, `COMPLETED`, `CANCELLED` | site pemilik | site peminjam | — |
| `LOAN_RETURN` | 3b — Pengembalian pinjaman | `IN_TRANSIT`, `RECEIVED` | site pemilik | site peminjam | `LOAN` asal |
| `ADJUSTMENT` | 4 — Adjustment harian | `COMPLETED` | site | — | — |
| `OPNAME` | 4 — Stock opname | `IN_PROGRESS`, `SUBMITTED`, `APPROVED`, `CANCELLED` | site | — | — |

Kolom khusus header:
- `requester_id` — hanya `REQUEST` (crew yang meminta; `id_user` bisa admin yang membuat atas nama crew).
- `reason` — hanya `REQUEST`: `PEMAKAIAN_HARIAN`, `PERBAIKAN`, `PROYEK`, `LAINNYA`. Catatan alasan di `remarks`.
- `inventory_type` — hanya `OPNAME` (`CONSUMABLE` / `NON_CONSUMABLE`).
- `status_changed_at` — waktu status terakhir berubah; dipakai untuk **tanda merah** (disetujui > 3 hari, diambil > 7 hari, dalam perjalanan > 3 hari).
- Siapa yang menyetujui / mengambil / menerima dan kapan → dicatat di `histories`.

## Pemakaian kolom item (`stock_movement_items`)

| `type` header | `quantity` | Kolom lain yang dipakai |
|---|---|---|
| *(keranjang, `movement_id` kosong)* | jumlah di keranjang | `id_user` |
| `REQUEST` | jumlah diminta | `qty_approved` (0 = dicoret); `ref_item_id` → item `LOAN` jika barang pinjaman |
| `RETURN` | — | `qty_good`, `qty_damaged`, `qty_lost` (non-consumable); `qty_good` = sisa, `qty_used` = terpakai (consumable); `ref_item_id` → item `REQUEST` |
| `GOODS_IN` | jumlah masuk | `qty_before`, `qty_after` |
| `TRANSFER` | jumlah dikirim | `dest_inventory_id` (diisi saat diterima); `ref_item_id` → item `LOAN` jika dari "jadikan permanen" |
| `LOAN` | jumlah dipinjamkan | — |
| `LOAN_RETURN` | jumlah dikirim balik | `qty_good`, `qty_damaged`, `qty_lost` (diisi saat diterima); `ref_item_id` → item `LOAN` |
| `ADJUSTMENT` | perubahan (+/−) | `reason` (`RUSAK`, `HILANG`, `KOREKSI`, `DITEMUKAN`, `LAINNYA`), `note`, `qty_before`, `qty_after` |
| `OPNAME` | hasil hitung fisik (kosong = belum diisi) | `qty_before` = stok sistem (snapshot), `qty_after` = stok setelah disetujui, `note` (wajib bila selisih) |

### Perhitungan (tidak disimpan, dihitung dari data)
- **Item permintaan selesai** bila jumlah `qty_good + qty_damaged + qty_lost + qty_used` dari semua `RETURN` yang `CONFIRMED` = `qty_approved`. Permintaan otomatis `COMPLETED` bila semua item selesai.
- **Sisa pinjaman di site peminjam** = `quantity` item `LOAN` − total dari `LOAN_RETURN` (termasuk yang masih dalam perjalanan) − jumlah yang dijadikan permanen (`TRANSFER` dengan `ref_item_id`) − rusak/hilang saat dipakai crew site peminjam.
- **Label "Dalam perjalanan kembali"** pada `LOAN` tampil bila ada `LOAN_RETURN` berstatus `IN_TRANSIT`.
- **Barang pinjaman di opname** = item opname yang `inventory.site_id` ≠ site opname.
- **Kunci opname** = ada `OPNAME` berstatus `IN_PROGRESS`/`SUBMITTED` untuk site & `inventory_type` yang sama.

## Aturan yang dijaga database

- `users`: `admin_pusat` wajib tanpa site; `admin` & `crew` wajib dengan site.
- `inventories`: `sku` unik; nama unik per site; `quantity >= 0`.
- `stock_movements.number` unik.
- Keranjang: satu barang hanya satu baris per user (`UNIQUE(id_user, inventory_id)` untuk baris dengan `movement_id` kosong).
- Hanya satu `OPNAME` aktif per site per `inventory_type` (partial unique index).
- Selebihnya (status valid per `type`, kolom mana yang wajib) dijaga di **kode backend**.

## Perubahan dari skema saat ini

| Tabel | Perubahan |
|---|---|
| `users` | `role` → `admin_pusat` / `admin` / `crew` (admin dari seed → `admin_pusat`); tambah `name`, `is_active` |
| `inventories` | tambah `is_active` |
| `stock_movements` | `type` diganti daftar baru; tambah `status_changed_at`, `site_id`, `to_site_id`, `parent_id`, `requester_id`, `inventory_type`; `receipt` → `number` |
| `inventory_carts` | **berganti nama** → `stock_movement_items`; `id_sm` → `movement_id`; tambah kolom `qty_*`, `dest_inventory_id`, `ref_item_id`, `reason`, `note`; kolom `status` & `receipt` dihapus |
| `histories` | tambah `action`; status mengikuti `type` transaksi |
| `sites`, `categories`, `sku_sequences` | tetap |

Tabel transaksi saat ini **belum berisi data**, jadi aman diubah lewat migrasi baru.
