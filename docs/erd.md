# ERD — Rancangan v2

> Status: **Draf untuk direview** (12 November 2026)
> Dasar: dokumen di `docs/workflow/` (peran, Case 1, 2, 3, 3b, 4).
> Belum ada migrasi; migrasi dibuat setelah rancangan ini disetujui.

## Prinsip rancangan

1. **Satu dokumen per case** — setiap case punya tabel header + item sendiri (permintaan, barang masuk, transfer, peminjaman, adjustment, opname). Status dan kolom tiap case berbeda, jadi tidak dipaksakan ke satu tabel.
2. **Satu buku besar stok (`stock_movements`)** — **setiap** perubahan `inventories.quantity` dicatat di sini: barang apa, berubah berapa, stok sebelum & sesudah, dan dokumen sumbernya. Dipakai untuk riwayat barang, laporan, dan opname.
3. **Satu timeline (`activity_logs`)** — mencatat siapa melakukan apa dan kapan pada setiap dokumen (dibuat, disetujui, diambil, dst.). Menggantikan tabel `histories`.
4. **`inventories.quantity` = stok tersedia di site pemilik.** Jumlah yang sedang dipinjamkan, dibawa crew, atau dalam perjalanan **tidak disimpan terpisah**, tetapi dihitung dari dokumen yang masih aktif.

## Gambaran besar

```mermaid
erDiagram
  SITES ||--o{ USERS : "punya"
  SITES ||--o{ INVENTORIES : "memiliki"
  CATEGORIES ||--o{ INVENTORIES : "mengelompokkan"
  USERS ||--o{ CART_ITEMS : "keranjang"
  INVENTORIES ||--o{ CART_ITEMS : ""

  REQUESTS ||--|{ REQUEST_ITEMS : "Case 1"
  REQUESTS ||--o{ REQUEST_RETURNS : "pengembalian"
  REQUEST_RETURNS ||--|{ REQUEST_RETURN_ITEMS : ""
  GOODS_RECEIPTS ||--|{ GOODS_RECEIPT_ITEMS : "Case 2"
  TRANSFERS ||--|{ TRANSFER_ITEMS : "Case 3"
  LOANS ||--|{ LOAN_ITEMS : "Case 3b"
  LOANS ||--o{ LOAN_RETURNS : "pengembalian"
  LOAN_RETURNS ||--|{ LOAN_RETURN_ITEMS : ""
  ADJUSTMENTS ||--|{ ADJUSTMENT_ITEMS : "Case 4"
  STOCK_OPNAMES ||--|{ STOCK_OPNAME_ITEMS : "Case 4"

  INVENTORIES ||--o{ STOCK_MOVEMENTS : "buku besar stok"
  USERS ||--o{ ACTIVITY_LOGS : "timeline"
```

---

## 1. Master data & pengguna

```mermaid
erDiagram
  SITES ||--o{ USERS : "punya (admin pusat: tanpa site)"
  SITES ||--o{ INVENTORIES : "memiliki"
  CATEGORIES ||--o{ INVENTORIES : "mengelompokkan"
  SITES ||--o{ SKU_SEQUENCES : ""
  USERS ||--o{ CART_ITEMS : "keranjang Case 1"
  INVENTORIES ||--o{ CART_ITEMS : ""

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
    enum role "BARU: admin_pusat, admin, crew"
    int site_id FK "null hanya untuk admin_pusat"
    boolean is_active "BARU: nonaktifkan, bukan hapus"
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
    varchar sku UK "MEGS-GMG-ET-001"
    varchar image
    int quantity "stok tersedia di site pemilik"
    boolean is_active "BARU: arsipkan, bukan hapus"
    timestamp created_at
    timestamp updated_at
  }
  SKU_SEQUENCES {
    int site_id PK
    enum type PK
    int last_number
  }
  CART_ITEMS {
    int id PK
    int user_id FK
    int inventory_id FK "milik site / pinjaman di site user"
    int quantity
    timestamp created_at
    timestamp updated_at
  }
```

- `users.role`: `admin_pusat` wajib **tanpa** site; `admin` dan `crew` wajib **dengan** site (dijaga constraint database).
- `cart_items` menggantikan `inventory_carts`; satu barang hanya satu baris per user (`UNIQUE(user_id, inventory_id)`), jumlahnya digabung.

---

## 2. Case 1 — Permintaan & pengembalian

```mermaid
erDiagram
  SITES ||--o{ REQUESTS : "site permintaan"
  USERS ||--o{ REQUESTS : "peminta (crew)"
  REQUESTS ||--|{ REQUEST_ITEMS : "berisi"
  INVENTORIES ||--o{ REQUEST_ITEMS : ""
  LOANS |o--o{ REQUEST_ITEMS : "jika barang pinjaman"
  REQUESTS ||--o{ REQUEST_RETURNS : "pengembalian bertahap"
  REQUEST_RETURNS ||--|{ REQUEST_RETURN_ITEMS : "berisi"
  REQUEST_ITEMS ||--o{ REQUEST_RETURN_ITEMS : ""

  REQUESTS {
    int id PK
    varchar number UK "format ditentukan Bima"
    int site_id FK
    int requester_id FK "crew peminta"
    int created_by FK "crew sendiri / admin atas nama crew"
    enum reason "PEMAKAIAN_HARIAN, PERBAIKAN, PROYEK, LAINNYA"
    text reason_note
    enum status "PENDING, APPROVED, PICKED_UP, COMPLETED, REJECTED, CANCELLED"
    int approved_by FK
    timestamp approved_at
    text reject_reason
    int picked_up_by FK "admin atau crew"
    timestamp picked_up_at
    timestamp completed_at
    timestamp created_at
    timestamp updated_at
  }
  REQUEST_ITEMS {
    int id PK
    int request_id FK
    int inventory_id FK
    int loan_id FK "diisi jika barang pinjaman (Case 3b)"
    int qty_requested
    int qty_approved "null sebelum disetujui; 0 = dicoret"
    int qty_returned_good "non-consumable kembali baik / sisa consumable"
    int qty_damaged "non-consumable"
    int qty_lost "non-consumable"
    int qty_used "consumable terpakai"
  }
  REQUEST_RETURNS {
    int id PK
    int request_id FK
    enum status "SUBMITTED, CONFIRMED, CANCELLED"
    int submitted_by FK "crew atau admin"
    int confirmed_by FK
    timestamp confirmed_at
    text note
    timestamp created_at
  }
  REQUEST_RETURN_ITEMS {
    int id PK
    int return_id FK
    int request_item_id FK
    int qty_good
    int qty_damaged
    int qty_lost
    int qty_used
  }
```

- Item **selesai** bila `qty_returned_good + qty_damaged + qty_lost + qty_used = qty_approved`. Permintaan otomatis `COMPLETED` bila semua item selesai.
- Kolom `qty_*` di `request_items` adalah **total** dari pengembalian yang sudah `CONFIRMED` (memudahkan tampilan & query).
- Tanda merah dihitung dari `approved_at` (> 3 hari belum diambil) dan `picked_up_at` (> 7 hari belum selesai) — tidak perlu kolom tambahan.

---

## 3. Case 2, 3, 3b — Barang masuk, transfer, peminjaman

```mermaid
erDiagram
  SITES ||--o{ GOODS_RECEIPTS : ""
  GOODS_RECEIPTS ||--|{ GOODS_RECEIPT_ITEMS : "berisi"
  INVENTORIES ||--o{ GOODS_RECEIPT_ITEMS : ""

  SITES ||--o{ TRANSFERS : "asal / tujuan"
  TRANSFERS ||--|{ TRANSFER_ITEMS : "berisi"
  INVENTORIES ||--o{ TRANSFER_ITEMS : "barang asal / tujuan"

  SITES ||--o{ LOANS : "pemilik / peminjam"
  LOANS ||--|{ LOAN_ITEMS : "berisi"
  INVENTORIES ||--o{ LOAN_ITEMS : "milik site pemilik"
  LOANS ||--o{ LOAN_RETURNS : "pengembalian bertahap"
  LOAN_RETURNS ||--|{ LOAN_RETURN_ITEMS : "berisi"
  LOAN_ITEMS ||--o{ LOAN_RETURN_ITEMS : ""
  LOANS |o--o| TRANSFERS : "dijadikan permanen"

  GOODS_RECEIPTS {
    int id PK
    varchar number UK
    int site_id FK
    text remarks "teks bebas"
    int created_by FK
    timestamp created_at
  }
  GOODS_RECEIPT_ITEMS {
    int id PK
    int receipt_id FK
    int inventory_id FK
    int quantity
    boolean is_new_item "barang dibuat lewat transaksi ini"
  }
  TRANSFERS {
    int id PK
    varchar number UK
    int from_site_id FK
    int to_site_id FK
    text reason
    enum status "IN_TRANSIT, COMPLETED, CANCELLED"
    int sent_by FK
    timestamp sent_at
    int received_by FK
    timestamp received_at
    text receive_note
    int loan_id FK "jika berasal dari peminjaman"
    timestamp created_at
    timestamp updated_at
  }
  TRANSFER_ITEMS {
    int id PK
    int transfer_id FK
    int source_inventory_id FK
    int dest_inventory_id FK "diisi saat diterima"
    int quantity
  }
  LOANS {
    int id PK
    varchar number UK
    int owner_site_id FK
    int borrower_site_id FK
    text reason
    enum status "IN_TRANSIT, BORROWED, COMPLETED, CANCELLED"
    int sent_by FK
    timestamp sent_at
    int received_by FK
    timestamp received_at
    timestamp completed_at
    timestamp created_at
    timestamp updated_at
  }
  LOAN_ITEMS {
    int id PK
    int loan_id FK
    int inventory_id FK "non-consumable milik site pemilik"
    int quantity
    int qty_returned_good
    int qty_damaged
    int qty_lost
    int qty_converted "dijadikan transfer permanen"
  }
  LOAN_RETURNS {
    int id PK
    int loan_id FK
    enum status "IN_TRANSIT, RECEIVED"
    int sent_by FK
    timestamp sent_at
    int received_by FK
    timestamp received_at
    text note
  }
  LOAN_RETURN_ITEMS {
    int id PK
    int return_id FK
    int loan_item_id FK
    int quantity "dikirim balik"
    int qty_good "diisi saat diterima"
    int qty_damaged
    int qty_lost
  }
```

- Label **"Dalam perjalanan kembali"** pada peminjaman ditampilkan bila ada `loan_returns` berstatus `IN_TRANSIT` (tidak perlu status tersendiri di `loans`).
- Jumlah pinjaman yang **masih di site peminjam** = `quantity − qty_returned_good − qty_damaged − qty_lost − qty_converted − (yang sedang dikirim balik)`.
- Rusak/hilang saat dipakai crew site peminjam (Case 1) menambah `loan_items.qty_damaged / qty_lost`.

---

## 4. Case 4 — Adjustment & stock opname

```mermaid
erDiagram
  SITES ||--o{ ADJUSTMENTS : ""
  ADJUSTMENTS ||--|{ ADJUSTMENT_ITEMS : "berisi"
  INVENTORIES ||--o{ ADJUSTMENT_ITEMS : ""
  SITES ||--o{ STOCK_OPNAMES : ""
  STOCK_OPNAMES ||--|{ STOCK_OPNAME_ITEMS : "berisi"
  INVENTORIES ||--o{ STOCK_OPNAME_ITEMS : ""

  ADJUSTMENTS {
    int id PK
    varchar number UK
    int site_id FK
    int created_by FK
    timestamp created_at
  }
  ADJUSTMENT_ITEMS {
    int id PK
    int adjustment_id FK
    int inventory_id FK
    int qty_change "positif = tambah, negatif = kurang"
    enum reason "RUSAK, HILANG, KOREKSI, DITEMUKAN, LAINNYA"
    text note
  }
  STOCK_OPNAMES {
    int id PK
    varchar number UK
    int site_id FK
    enum type "CONSUMABLE / NON_CONSUMABLE"
    enum status "IN_PROGRESS, SUBMITTED, APPROVED, CANCELLED"
    int started_by FK
    timestamp started_at
    timestamp submitted_at
    int approved_by FK
    timestamp approved_at
    text return_note "catatan saat dikembalikan admin pusat"
    timestamp created_at
    timestamp updated_at
  }
  STOCK_OPNAME_ITEMS {
    int id PK
    int opname_id FK
    int inventory_id FK
    boolean is_borrowed "barang pinjaman dari site lain"
    int system_qty "stok sebelum (snapshot)"
    int physical_qty "hasil hitung; null = belum diisi"
    int difference "physical_qty - system_qty"
    text note "wajib bila ada selisih"
  }
```

- **Kunci opname** tidak perlu tabel: transaksi ditahan bila ada `stock_opnames` berstatus `IN_PROGRESS`/`SUBMITTED` untuk site & jenis barang yang sama.
- Hanya satu opname aktif per site per jenis (dijaga partial unique index).

---

## 5. Buku besar stok & timeline

```mermaid
erDiagram
  INVENTORIES ||--o{ STOCK_MOVEMENTS : "setiap perubahan quantity"
  SITES ||--o{ STOCK_MOVEMENTS : ""
  USERS ||--o{ STOCK_MOVEMENTS : "pelaku"
  USERS ||--o{ ACTIVITY_LOGS : "pelaku"

  STOCK_MOVEMENTS {
    int id PK
    int inventory_id FK
    int site_id FK "site tempat perubahan"
    enum movement_type
    int qty_change "positif / negatif"
    int qty_before
    int qty_after
    varchar source_type "requests, goods_receipts, transfers, loans, adjustments, stock_opnames"
    int source_id
    int created_by FK
    timestamp created_at
  }
  ACTIVITY_LOGS {
    int id PK
    varchar source_type
    int source_id
    varchar action "CREATED, APPROVED, REJECTED, PICKED_UP, ..."
    text note
    int user_id FK
    timestamp created_at
  }
  DOCUMENT_SEQUENCES {
    varchar key PK "misal jenis + site + tanggal"
    int last_number
  }
```

**`movement_type`** (arah perubahan `inventories.quantity`):

| Tipe | Arah | Kapan |
|---|---|---|
| `INITIAL` | + | Barang dibuat langsung dengan stok awal |
| `GOODS_IN` | + | Barang masuk (Case 2) |
| `REQUEST_APPROVED` | − | Permintaan disetujui (Case 1) |
| `REQUEST_CANCELLED` | + | Permintaan yang sudah disetujui dibatalkan |
| `REQUEST_RETURNED` | + | Kembali baik / sisa consumable (Case 1) |
| `TRANSFER_OUT` / `TRANSFER_IN` | − / + | Kirim / terima transfer (Case 3) |
| `TRANSFER_CANCELLED` | + | Transfer dibatalkan |
| `LOAN_OUT` / `LOAN_RETURNED` | − / + | Kirim pinjaman / terima kembali baik (Case 3b) |
| `LOAN_CANCELLED` | + | Peminjaman dibatalkan |
| `ADJUSTMENT` | ± | Adjustment harian (Case 4) |
| `OPNAME` | ± | Opname disetujui (Case 4) |

- Barang **rusak/hilang** setelah keluar gudang tidak mengubah `quantity` lagi (sudah berkurang saat keluar); tercatat di item pengembalian (`qty_damaged`, `qty_lost`) dan bisa dilaporkan dari sana.
- `source_type + source_id` menunjuk ke dokumen sumber (tanpa foreign key, agar satu kolom bisa menunjuk ke beberapa tabel). Integritasnya dijaga di kode.
- `document_sequences` untuk nomor transaksi; formatnya menunggu keputusan Bima.

---

## Perubahan dari skema saat ini

| Tabel | Perubahan |
|---|---|
| `users` | `role` → `admin_pusat` / `admin` / `crew`; tambah `name`, `is_active` |
| `inventories` | tambah `is_active` |
| `inventory_carts` | **dihapus** → `cart_items` |
| `stock_movements` (lama) | **dihapus** → dokumen per case + `stock_movements` baru (buku besar) |
| `histories` | **dihapus** → `activity_logs` |
| `sites`, `categories`, `sku_sequences` | tetap |
| Tabel baru | `requests`, `request_items`, `request_returns`, `request_return_items`, `goods_receipts`, `goods_receipt_items`, `transfers`, `transfer_items`, `loans`, `loan_items`, `loan_returns`, `loan_return_items`, `adjustments`, `adjustment_items`, `stock_opnames`, `stock_opname_items`, `activity_logs`, `document_sequences` |

Tabel yang dihapus saat ini **belum berisi data transaksi**, jadi aman diganti lewat migrasi baru.
