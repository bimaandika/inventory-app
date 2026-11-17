# Inventory App

Aplikasi manajemen inventory multi-site dengan tiga peran:

- **Admin pusat**: kelola seluruh sistem (site, kategori, user) dan bisa bertindak di semua site.
- **Admin site**: kelola barang dan transaksi di site-nya sendiri.
- **Crew**: lihat barang di site sendiri, ajukan permintaan, laporkan pengembalian.

Aturan bisnis lengkap ada di `docs/workflow/`, rancangan database di `docs/erd.md`.

## Tech stack

| Bagian   | Teknologi                          |
|----------|------------------------------------|
| Backend  | Node.js, Express, PostgreSQL (`pg`), JWT |
| Frontend | React, Vite, React Router          |

## Struktur folder

Backend memakai **Sequelize** (CommonJS) dengan struktur **per fitur**: setiap fitur punya controller & route sendiri, hak akses diatur lewat middleware `authorize(...)`.

```
inventory-app/
├── backend/
│   ├── .sequelizerc       # Lokasi config/models/migrations/seeders untuk sequelize-cli
│   ├── migrations/        # Migrasi Sequelize (satu file per tabel)
│   ├── seeders/           # Data awal: 5 site + admin pusat
│   ├── src/
│   │   ├── config/        # config.js (database dari .env), upload.js (foto)
│   │   ├── models/        # Model Sequelize + relasi (index.js)
│   │   ├── controllers/   # Logika endpoint, per fitur
│   │   ├── routes/        # Definisi route, per fitur
│   │   ├── middlewares/   # authenticate, authorize, errorHandler
│   │   ├── services/      # Logika bisnis bersama (SKU, stok, nomor transaksi)
│   │   ├── helpers/       # bcrypt, jwt, validasi, error HTTP
│   │   ├── app.js
│   │   └── server.js
│   └── uploads/           # Foto kondisi barang
├── frontend/
│   └── src/
│       ├── api/           # Wrapper fetch ke backend
│       ├── components/
│       ├── context/
│       ├── pages/
│       └── App.jsx
└── docs/
    ├── API.md             # Daftar endpoint
    ├── erd.md             # Rancangan database
    ├── workflow/          # Keputusan alur kerja per case
    └── requests/          # Contoh request (REST Client / Postman)
```

## Menjalankan secara lokal

### Prasyarat
- Node.js 18+
- PostgreSQL 14+

### 1. Backend & database
```bash
cd backend
cp .env.example .env      # sesuaikan DB_* dan JWT_SECRET
npm install
npm run db:create         # buat database sesuai DB_NAME (lewati jika sudah ada)
npm run migrate           # buat semua tabel dari migrations/
npm run seed              # 5 site + admin pusat + data sample (kategori & 10 barang)
npm run dev               # http://localhost:5050/api
```

Cek: `GET http://localhost:5050/api/health`

Perintah database lain:

| Perintah | Fungsi |
|---|---|
| `npm run seed:sample` | Isi ulang data sample kategori & barang saja |
| `npm run migrate:undo` | Batalkan migrasi terakhir |
| `npm run db:reset` | Hapus semua tabel, migrasi ulang, lalu seed (**semua data hilang**) |
| `npx sequelize-cli migration:generate --name nama-migrasi` | Buat file migrasi baru |

### 2. Frontend
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Saat development, Vite meneruskan request `/api` ke backend di port 5050.

## Skema database

Lihat `docs/erd.md`. Tabel: `sites`, `users`, `categories`, `inventories`, `sku_sequences`, `stock_movements`, `stock_movement_items`, `histories`.

Migrasi dibuat dengan Sequelize (satu file per tabel). SKU barang dibuat otomatis dengan format `MEGS-<kode site>-<ET|SM>-<nomor>`.

## Alur kerja

Keputusan alur kerja ada di `docs/workflow/`:

| Dokumen | Isi |
|---|---|
| `peran-hak-akses.md` | Admin pusat, admin site, crew |
| `case-1-pengambilan-pengembalian.md` | Permintaan crew, pengambilan, pengembalian |
| `case-2-pengadaan-barang-masuk.md` | Barang masuk |
| `case-3-pemindahan-inventory.md` | Transfer permanen antar site |
| `case-3b-peminjaman-antar-site.md` | Peminjaman antar site |
| `case-4-adjustment-stock-opname.md` | Adjustment harian & stock opname |
