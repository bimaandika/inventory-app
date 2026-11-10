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

## Inventories (master barang)
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/inventories?category_id=&search=` | semua | Katalog |
| GET | `/inventories/:id` | semua | Detail + stok per site |
| POST / PUT / DELETE | `/inventories/:id` | admin | |

## Stocks
| Method | Endpoint | Role | Keterangan |
|---|---|---|---|
| GET | `/stocks?site_id=&category_id=&search=&low_stock=true` | semua | Crew dipaksa ke site sendiri |
| GET | `/stocks/:id` | semua | |
| GET | `/stocks/sku/:sku` | semua | Scan SKU |
| POST | `/stocks` | admin | multipart, dengan foto kondisi |
| PUT | `/stocks/:id` | admin | Ubah SKU (bukan quantity) |
| PATCH | `/stocks/:id/image` | admin | Ganti foto kondisi |
| DELETE | `/stocks/:id` | admin | |

`quantity` hanya berubah lewat stock movement.

## Cart
| Method | Endpoint | Keterangan |
|---|---|---|
| GET | `/cart` | Isi cart sendiri (`in_cart`) |
| POST | `/cart` | `{ id_stock, quantity }` |
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
