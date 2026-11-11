# Rancangan API

Base URL: `/api`. Semua endpoint (kecuali login dan health) memerlukan header `Authorization: Bearer <token>`.

Keterangan role: **semua** = admin & crew, **admin** = hanya admin, **crew** = pemilik data.

## Auth
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| POST | `/auth/login` | publik | Mengembalikan JWT (`id`, `role`, `site_id`) |
| GET | `/auth/me` | semua | Profil user login |
| PATCH | `/auth/password` | semua | Ganti password sendiri |

## Users (admin)
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/users?role=&site_id=&search=` | Daftar user |
| GET | `/users/:id` | Detail |
| POST | `/users` | Buat akun |
| PUT | `/users/:id` | Ubah data, role, site |
| PATCH | `/users/:id/reset-password` | Reset password |
| DELETE | `/users/:id` | Hapus |

## Sites & Categories
| Method | Endpoint | Role |
|---|---|---|
| GET | `/sites`, `/categories` | semua (crew hanya site sendiri) |
| GET | `/sites/:id`, `/categories/:id` | semua |
| POST / PUT / DELETE | `/sites/:id`, `/categories/:id` | admin |

## Inventories (barang per site)
Satu baris = satu barang di satu site. Barang yang sama di dua site disimpan sebagai dua baris dengan SKU berbeda.

| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/inventories?search=&category_id=&type=&site_id=&page=&limit=` | semua | `search` mencari nama & SKU. Crew otomatis dibatasi ke site sendiri |
| GET | `/inventories/:id` | semua | Crew hanya untuk site sendiri |
| GET | `/inventories/sku/:sku` | semua | Scan SKU |
| POST | `/inventories` | admin | Body: `name`, `unit`, `type`, `description`, `category_id`, `site_id`, `sku`, `quantity` (stok awal, opsional) |
| PUT | `/inventories/:id` | admin | Body sama seperti POST **tanpa** `quantity` |
| PATCH | `/inventories/:id/image` | admin | *(Tahap 2)* Upload foto kondisi barang |
| DELETE | `/inventories/:id` | admin | |

- `type`: `CONSUMABLE` (habis pakai) atau `NON_CONSUMABLE` (tidak habis pakai, misal tools).
- `sku` unik di seluruh sistem dan disimpan dalam huruf besar.
- Nama barang unik per site (tidak peka huruf besar/kecil).
- `quantity` hanya diisi saat barang dibuat; perubahan berikutnya lewat stock movement.

### Aturan barang NON_CONSUMABLE
- Semua pergerakan (barang masuk, rusak/hilang, dipinjam site lain) dicatat oleh **admin**.
- Dipinjam site lain **tidak memindahkan kepemilikan**; site peminjam ditulis di `remarks`.
- Crew **tidak bisa** meminta NON_CONSUMABLE lewat cart; crew hanya bisa melihat ketersediaannya.

## Cart
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/cart` | Isi cart sendiri (`in_cart`) |
| POST | `/cart` | `{ id_inventory, quantity }` (hanya barang CONSUMABLE di site sendiri) |
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
