# Rancangan API

Base URL: `/api`. Semua endpoint (kecuali login dan health) memerlukan header `Authorization: Bearer <token>`.

Peran (lihat `docs/workflow/peran-hak-akses.md`):
- **pusat** = `admin_pusat` — semua site
- **admin** = `admin` (admin site) — bertindak hanya di site sendiri, boleh melihat site lain
- **crew** = `crew` — hanya site sendiri
- **semua** = ketiga peran di atas

**Penamaan field:** seluruh API (body request, query parameter, dan response) memakai **camelCase**, misal `siteId`, `categoryId`, `isActive`, `createdAt`. Kolom di database tetap snake_case (`site_id`, `is_active`); Sequelize menerjemahkannya otomatis.

Daftar yang kosong tetap mengembalikan `data: []`, ditambah `message` yang menjelaskan alasannya, misal `"Belum ada data barang"` atau `"Tidak ada barang yang cocok dengan pencarian atau filter"`.

Response objek barang & user menyertakan relasi bertingkat, misal `"site": { "id", "name", "code" }` dan `"category": { "id", "name" }`.

Token hanya berisi `id` user; role, site, dan status aktif selalu dibaca ulang dari database di setiap request, sehingga perubahan langsung berlaku. User nonaktif ditolak (401).

## Auth
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | publik | Body `{ username, password }` → `{ token, user }`. User nonaktif ditolak (403) |
| GET | `/auth/me` | semua | Profil: `id`, `username`, `name`, `role`, `siteId`, `site` |
| PATCH | `/auth/password` | semua | Body `{ oldPassword, newPassword }` |

## Users (pusat)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/users?role=&siteId=&search=&includeInactive=&page=&limit=` | Daftar user (default hanya yang aktif) |
| GET | `/users/:id` | Detail |
| POST | `/users` | Body `{ username, name, password, role, siteId }` |
| PUT | `/users/:id` | Body `{ name, role, siteId }` (username tidak bisa diubah) |
| PATCH | `/users/:id/password` | Body `{ newPassword }` — reset password |
| PATCH | `/users/:id/active` | Body `{ isActive: true/false }` — user tidak dihapus, tetapi dinonaktifkan |

- `role`: `admin_pusat` (tanpa `siteId`), `admin` / `crew` (wajib `siteId`).
- `username`: 3–50 karakter, huruf kecil/angka/`.`/`_`/`-` (otomatis dijadikan huruf kecil). Password minimal 6 karakter.
- Tidak bisa menonaktifkan atau mengubah role akun sendiri; harus selalu ada minimal satu admin pusat aktif.

## Sites & Categories
| Method | Endpoint | Role |
|---|---|---|
| GET | `/sites`, `/categories` | semua (crew hanya melihat site sendiri) |
| GET | `/sites/:id`, `/categories/:id` | semua |
| POST / PUT / DELETE | `/sites/:id`, `/categories/:id` | pusat |

Body site: `{ name, code }`. `code` (huruf besar/angka, maks 10, unik) dipakai di SKU dan **tidak bisa diubah** jika site sudah punya barang.

## Inventories (barang per site)
Satu baris = satu barang di satu site. Barang yang sama di dua site disimpan sebagai dua baris dengan SKU berbeda.

| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/inventories?search=&categoryId=&type=&siteId=&includeInactive=&page=&limit=` | semua | `search` mencari nama & SKU. Crew otomatis dibatasi ke site sendiri & barang aktif |
| GET | `/inventories/:id` | semua | Crew hanya untuk barang aktif di site sendiri |
| GET | `/inventories/sku/:sku` | semua | Scan SKU |
| POST | `/inventories` | pusat, admin | Body: `name`, `unit`, `type`, `description`, `categoryId`, `siteId`, `quantity` (stok awal, opsional). SKU dibuat otomatis. Admin site hanya untuk site sendiri. Jika `quantity > 0`, stok awal otomatis tercatat sebagai **barang masuk** (response menyertakan `goodsIn: { id, number }`) |
| PUT | `/inventories/:id` | pusat, admin | Body sama seperti POST **tanpa** `quantity`. Hanya pusat yang boleh mengganti `siteId` |
| PATCH | `/inventories/:id/active` | pusat, admin | Body `{ isActive: true/false }` — nonaktifkan / aktifkan kembali |
| DELETE | `/inventories/:id` | pusat, admin | Hanya untuk barang tanpa riwayat transaksi (409 jika sudah ada → nonaktifkan) |
| PATCH | `/inventories/:id/image` | pusat, admin | Upload foto kondisi: **form-data**, field `image` (JPG/PNG/WEBP, maks `UPLOAD_MAX_MB`, default 2 MB). Foto lama dihapus |
| DELETE | `/inventories/:id/image` | pusat, admin | Hapus foto tanpa menghapus barang |

Foto bisa dibuka di `http://localhost:5050<image>`, misal `http://localhost:5050/uploads/inventories/abc123.jpg`.

- `type`: `CONSUMABLE` (habis pakai) atau `NON_CONSUMABLE` (tidak habis pakai, misal tools).
- **SKU otomatis**: `MEGS-<kode site>-<kode jenis>-<nomor urut>`, contoh `MEGS-GMG-ET-001`.
  - Kode jenis: `NON_CONSUMABLE` = `ET`, `CONSUMABLE` = `SM`.
  - Nomor urut per site per jenis, minimal 3 digit; nomor yang pernah dipakai tidak dipakai ulang.
  - Jika `siteId` atau `type` barang diubah, SKU dibuat ulang mengikuti site/jenis baru.
  - Mengirim `sku` di body akan ditolak (400).
- Nama barang unik per site (tidak peka huruf besar/kecil).
- `quantity` hanya diisi saat barang dibuat; perubahan berikutnya lewat stock movement.

### Alur kerja
Aturan bisnis per case ada di folder `docs/workflow/`:
- Case 1 — Pengambilan & pengembalian: `docs/workflow/case-1-pengambilan-pengembalian.md`
  (consumable dan non-consumable bisa diminta dalam satu keranjang; non-consumable dikembalikan, sisa consumable dilaporkan)
- Case 2 — Pengadaan / barang masuk: `docs/workflow/case-2-pengadaan-barang-masuk.md`
  (tanpa approval; dicatat saat barang datang sebagai movement `IN` + remarks)
- Case 3 — Pemindahan inventory: `docs/workflow/case-3-pemindahan-inventory.md`
  (permanen; dua langkah Kirim → Terima; SKU baru di site tujuan)
- Case 3b — Peminjaman antar site: `docs/workflow/case-3b-peminjaman-antar-site.md`
  (non-consumable; kepemilikan tetap; tampil di katalog peminjam; wajib kembali)
- Case 4 — Adjustment & stock opname: `docs/workflow/case-4-adjustment-stock-opname.md`
  (adjustment harian tanpa approval; opname per site per jenis, disetujui admin pusat)
- Peran & hak akses (admin pusat, admin site, crew): `docs/workflow/peran-hak-akses.md`

> Endpoint Cart dan Stock movements di bawah masih rancangan awal dan akan disesuaikan dengan dokumen workflow.

## Barang Masuk — Case 2 (pusat, admin)
Aturan: `docs/workflow/case-2-pengadaan-barang-masuk.md`. Nomor: `IN-<site>-<MMYY>-<nomor>`.

| Method | Endpoint | Keterangan |
|---|---|---|
| POST | `/goods-in` | Catat barang masuk. Admin site hanya untuk site sendiri |
| GET | `/goods-in?siteId=&search=&from=&to=&page=&limit=` | Daftar transaksi (terbaru dulu). `search` mencari nomor & remarks; `from`/`to` format `YYYY-MM-DD` (WIB) |
| GET | `/goods-in/:id` | Detail: daftar barang + stok sebelum/sesudah + timeline |

Body `POST /goods-in` — satu transaksi untuk satu site, boleh mencampur barang lama dan barang baru:
```json
{
  "siteId": 1,
  "remarks": "Pengadaan SCM PO-123",
  "items": [
    { "inventoryId": 4, "quantity": 20 },
    { "name": "Sarung Tangan Las", "unit": "pasang", "type": "CONSUMABLE", "categoryId": 4, "description": null, "quantity": 10 }
  ]
}
```
- Item dengan `inventoryId` = barang yang sudah ada (harus milik site tersebut dan aktif).
- Item tanpa `inventoryId` = barang baru; otomatis masuk katalog dengan SKU otomatis. Ditolak jika nama sudah ada di site itu.
- `quantity` > 0. Barang yang sama tidak boleh muncul dua kali dalam satu transaksi.
- Ditolak (409) jika site sedang **stock opname** untuk jenis barang yang terlibat.
- Tanpa approval: stok langsung bertambah. Salah input dikoreksi lewat adjustment (Case 4).

Daftar transaksi menyertakan `totalItems` (jumlah baris barang) dan `totalQuantity`.

## Transaksi lain (belum dibuat)

Endpoint transaksi lainnya (keranjang, permintaan, pengembalian, transfer, peminjaman, adjustment, stock opname) akan ditambahkan bertahap mengikuti aturan di `docs/workflow/` dan struktur data di `docs/erd.md`.

Format nomor transaksi: `docs/workflow/nomor-transaksi.md`.
