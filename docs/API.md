# Rancangan API

Base URL: `/api`. Semua endpoint (kecuali login dan health) memerlukan header `Authorization: Bearer <token>`.

Peran (lihat `docs/workflow/peran-hak-akses.md`):
- **pusat** = `admin_pusat` — semua site
- **admin** = `admin` (admin site) — bertindak hanya di site sendiri, boleh melihat site lain
- **crew** = `crew` — hanya site sendiri
- **semua** = ketiga peran di atas

Token hanya berisi `id` user; role, site, dan status aktif selalu dibaca ulang dari database di setiap request, sehingga perubahan langsung berlaku. User nonaktif ditolak (401).

## Auth
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | publik | Body `{ username, password }` → `{ token, user }`. User nonaktif ditolak (403) |
| GET | `/auth/me` | semua | Profil: `id`, `username`, `name`, `role`, `site_id`, `site_name`, `site_code` |
| PATCH | `/auth/password` | semua | Body `{ old_password, new_password }` |

## Users (pusat)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/users?role=&site_id=&search=&include_inactive=&page=&limit=` | Daftar user (default hanya yang aktif) |
| GET | `/users/:id` | Detail |
| POST | `/users` | Body `{ username, name, password, role, site_id }` |
| PUT | `/users/:id` | Body `{ name, role, site_id }` (username tidak bisa diubah) |
| PATCH | `/users/:id/password` | Body `{ new_password }` — reset password |
| PATCH | `/users/:id/active` | Body `{ is_active: true/false }` — user tidak dihapus, tetapi dinonaktifkan |

- `role`: `admin_pusat` (tanpa `site_id`), `admin` / `crew` (wajib `site_id`).
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
| GET | `/inventories?search=&category_id=&type=&site_id=&include_inactive=&page=&limit=` | semua | `search` mencari nama & SKU. Crew otomatis dibatasi ke site sendiri & barang aktif |
| GET | `/inventories/:id` | semua | Crew hanya untuk barang aktif di site sendiri |
| GET | `/inventories/sku/:sku` | semua | Scan SKU |
| POST | `/inventories` | pusat, admin | Body: `name`, `unit`, `type`, `description`, `category_id`, `site_id`, `quantity` (stok awal, opsional). SKU dibuat otomatis. Admin site hanya untuk site sendiri |
| PUT | `/inventories/:id` | pusat, admin | Body sama seperti POST **tanpa** `quantity`. Hanya pusat yang boleh mengganti `site_id` |
| PATCH | `/inventories/:id/active` | pusat, admin | Body `{ is_active: true/false }` — nonaktifkan / aktifkan kembali |
| DELETE | `/inventories/:id` | pusat, admin | Hanya untuk barang tanpa riwayat transaksi (409 jika sudah ada → nonaktifkan) |
| PATCH | `/inventories/:id/image` | pusat, admin | Upload foto kondisi: **form-data**, field `image` (JPG/PNG/WEBP, maks `UPLOAD_MAX_MB`, default 2 MB). Foto lama dihapus |
| DELETE | `/inventories/:id/image` | pusat, admin | Hapus foto tanpa menghapus barang |

Foto bisa dibuka di `http://localhost:5050<image>`, misal `http://localhost:5050/uploads/inventories/abc123.jpg`.

- `type`: `CONSUMABLE` (habis pakai) atau `NON_CONSUMABLE` (tidak habis pakai, misal tools).
- **SKU otomatis**: `MEGS-<kode site>-<kode jenis>-<nomor urut>`, contoh `MEGS-GMG-ET-001`.
  - Kode jenis: `NON_CONSUMABLE` = `ET`, `CONSUMABLE` = `SM`.
  - Nomor urut per site per jenis, minimal 3 digit; nomor yang pernah dipakai tidak dipakai ulang.
  - Jika `site_id` atau `type` barang diubah, SKU dibuat ulang mengikuti site/jenis baru.
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

## Cart
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/cart` | Isi cart sendiri (`in_cart`) |
| POST | `/cart` | `{ id_inventory, quantity }` (barang di site sendiri) |
| PATCH | `/cart/:id` | Ubah quantity |
| DELETE | `/cart/:id` | Hapus item |
| DELETE | `/cart` | Kosongkan |
| POST | `/cart/checkout` | `{ reason }` → buat movement `pending`, isi `id_sm` & `receipt` |

## Stock movements
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/stock-movements?status=&type=&from=&to=` | semua | Crew hanya miliknya |
| GET | `/stock-movements/:id` | semua | Detail + item + history |
| PATCH | `/stock-movements/:id/approve` | admin | Transaksi: kurangi stok, status, history |
| PATCH | `/stock-movements/:id/reject` | admin | `{ remarks }` |
| PATCH | `/stock-movements/:id/cancel` | crew | Hanya saat `pending` |
| PATCH | `/stock-movements/:id/complete` | crew | Konfirmasi diterima |
| POST | `/stock-movements/stock-in` | admin | Restock (`IN`) / penyesuaian (`ADJUSTMENT`) |

## History, dashboard, laporan
| Method | Endpoint | Role |
|---|---|---|
| GET | `/stock-movements/:id/history` | semua |
| GET | `/histories?from=&to=` | admin |
| GET | `/dashboard` | semua |
| GET | `/reports/movements?from=&to=&site_id=&format=csv` | admin |
| GET | `/reports/low-stock?threshold=` | admin |

## Status
```
Cart:           in_cart → submitted
Stock movement: pending → approved → completed
                pending → rejected | cancelled
```
