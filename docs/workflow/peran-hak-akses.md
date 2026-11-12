# Peran & Hak Akses

> Status: **Disepakati & dikonfirmasi** (12 November 2026)
> Berlaku untuk semua case. **Tidak ada approval berjenjang** (coordinator/manager) untuk saat ini.

## Peran

| Peran | Terikat site? | Ringkasan |
|---|---|---|
| **Admin pusat** | Tidak (semua site) | Mengelola seluruh sistem dan bisa bertindak di site mana pun, termasuk mengambil alih site yang belum punya admin |
| **Admin site** | Ya, satu site | Mengelola operasional site-nya sendiri |
| **Crew** | Ya, satu site | Meminta barang di site-nya sendiri dan melaporkan pengembalian |

Setiap site punya admin site masing-masing. Admin pusat dibutuhkan, misalnya saat site baru dibuka dan belum ada admin site.

## Hak akses per fitur

| Fitur | Admin pusat | Admin site | Crew |
|---|---|---|---|
| Kelola **site**, **kategori**, **user** | ✅ | ❌ | ❌ |
| Kelola **inventory** (tambah/ubah/hapus, foto) | ✅ semua site | ✅ site sendiri | ❌ |
| Lihat katalog | ✅ semua site | ✅ semua site *(lihat saja; bertindak hanya di site sendiri)* | ✅ site sendiri |
| **Case 1** — buat permintaan | ✅ atas nama crew | ✅ atas nama crew site sendiri | ✅ site sendiri |
| **Case 1** — setujui/tolak, tandai diambil, konfirmasi pengembalian | ✅ | ✅ site sendiri | Tandai diambil & ajukan pengembalian (milik sendiri) |
| **Case 2** — barang masuk | ✅ | ✅ site sendiri | ❌ |
| **Case 3** — kirim transfer | ✅ | ✅ dari site sendiri | ❌ |
| **Case 3** — terima transfer | ✅ (boleh transfer yang dikirimnya sendiri) | ✅ ke site sendiri | ❌ |
| **Case 3b** — kirim peminjaman & terima kembali | ✅ | ✅ sebagai site pemilik | ❌ |
| **Case 3b** — terima pinjaman & kembalikan | ✅ | ✅ sebagai site peminjam | ❌ |
| **Case 4** — adjustment harian | ✅ | ✅ site sendiri | ❌ |
| **Case 4** — mulai, input & ajukan stock opname | ✅ (langsung berlaku) | ✅ site sendiri | ❌ |
| **Case 4** — setujui / kembalikan stock opname | ✅ | ❌ | ❌ |

## Catatan

- Admin site **boleh melihat** katalog site lain (misal untuk tahu site mana yang punya stok sebelum transfer), tetapi **hanya bisa bertindak** di site sendiri.
- Crew hanya melihat dan bertindak di site sendiri (sesuai implementasi saat ini).

## Dampak teknis (disetujui)

- Role dibuat **eksplisit**: `admin_pusat` (tanpa site), `admin` (wajib site), `crew` (wajib site) — bukan sekadar admin dengan `site_id` kosong, supaya admin site tidak menjadi admin pusat karena lupa mengisi site.
- Middleware & controller yang saat ini menganggap semua admin bersifat global perlu disesuaikan (inventory create/update/delete, scope site).
- Pengelolaan site & kategori dibatasi untuk admin pusat.
- Akun admin dari `npm run seed` menjadi **admin pusat**.

## Nomor transaksi

Format nomor transaksi untuk semua case (permintaan, barang masuk, transfer, peminjaman, adjustment/opname) **ditentukan oleh Bima**, seperti format SKU. Contoh di dokumen case bersifat sementara.
