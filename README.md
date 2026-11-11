# Inventory App

Aplikasi manajemen inventory multi-site dengan dua peran:

- **Admin**: kelola master data (site, kategori, barang, stok, user), setujui/tolak permintaan barang, catat stok masuk, lihat laporan semua site.
- **Crew**: lihat stok di site sendiri, ajukan permintaan barang lewat cart, pantau status permintaannya.

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
npm run seed              # buat akun admin awal
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

Migrasi dijalankan berurutan (`001` → `002` → `003` …). Sejak `003`, tabel `stocks` digabung ke `inventories`: satu baris = satu barang di satu site.

Alur permintaan barang:

```
Crew: tambah ke cart (in_cart) → checkout → stock_movement (pending) + history
Admin: approve → stok berkurang (dalam transaksi) → approved + history
       reject  → rejected + history
Crew:  cancel (selama pending) / complete (barang diterima)
```
