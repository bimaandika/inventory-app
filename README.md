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

```
inventory-app/
├── backend/
│   ├── migrations/        # File SQL skema database (dijalankan berurutan)
│   ├── scripts/           # migrate.js, seed.js
│   ├── src/
│   │   ├── config/        # Koneksi database
│   │   ├── controllers/   # Logika tiap endpoint
│   │   ├── middlewares/   # auth (JWT, role, site scope), error handler
│   │   ├── routes/        # Definisi route Express
│   │   ├── services/      # Logika bisnis yang dipakai bersama
│   │   ├── utils/
│   │   ├── app.js
│   │   └── server.js
│   └── uploads/           # Foto kondisi barang per site
├── frontend/
│   └── src/
│       ├── api/           # Wrapper fetch ke backend
│       ├── components/
│       ├── context/
│       ├── pages/
│       └── App.jsx
└── docs/
    └── API.md             # Rancangan endpoint
```

## Menjalankan secara lokal

### Prasyarat
- Node.js 18+
- PostgreSQL 14+

### 1. Database
```bash
createdb inventory_db
```

### 2. Backend
```bash
cd backend
cp .env.example .env      # sesuaikan kredensial database & JWT_SECRET
npm install
npm run migrate           # buat tabel dari migrations/
npm run seed              # buat akun admin pusat + 5 site (GMG, POMS, GEG, FOL, TRK)
npm run dev               # http://localhost:5050/api
```

Cek: `GET http://localhost:5050/api/health`

### 3. Frontend
```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

Saat development, Vite meneruskan request `/api` ke backend di port 5050.

## Skema database

Lihat `backend/migrations/001_init.sql`. Tabel: `sites`, `users`, `categories`, `inventories`, `stock_movements`, `inventory_carts`, `histories`.

Migrasi dijalankan berurutan (`001` → `002` → `003` …). Sejak `003`, tabel `stocks` digabung ke `inventories`: satu baris = satu barang di satu site. Sejak `004`, SKU dibuat otomatis dengan format `MEGS-<kode site>-<ET|SM>-<nomor>`.

Alur permintaan barang:

```
Crew: tambah ke cart (in_cart) → checkout → stock_movement (pending) + history
Admin: approve → stok berkurang (dalam transaksi) → approved + history
       reject  → rejected + history
Crew:  cancel (selama pending) / complete (barang diterima)
```
