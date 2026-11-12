# Case 2 — Pengadaan (Barang Masuk)

> Status: **Disepakati** (12 November 2026)
> Pengguna: **Admin** saja. **Tanpa approval.**
> **Admin** di dokumen ini = admin site (untuk site-nya sendiri) atau admin pusat. Lihat [Peran & hak akses](peran-hak-akses.md).

## Ringkasan

Proses pembelian ke SCM / petty cash berjalan **di luar aplikasi**.
Aplikasi mencatatnya sebagai **Barang Masuk** pada saat barang datang: stok bertambah dan tercatat di stock movement bertipe `IN` beserta remarks.

## Alur

```
Admin                                                         Stok
────────────────────────────────────────────────────────────────────
1. Buka "Barang Masuk", pilih site
2. Tambahkan barang (boleh campur):
   • Barang sudah ada  → pilih dari katalog + isi jumlah
   • Barang baru       → isi detail barang + jumlah
3. Isi remarks (teks bebas)
4. Simpan  ───────────────────────────────────────────────►  bertambah
   → nomor transaksi IN-<site>-<tanggal>-<urut>
```

## Aturan

### Transaksi
1. **Satu transaksi = satu site**, boleh berisi **beberapa barang** (barang baru dan barang yang sudah ada boleh dicampur).
2. Nomor transaksi: **`IN-<kode site>-<YYYYMMDD>-<nomor urut harian>`**, contoh `IN-GMG-20261112-001`.
3. **Remarks berupa teks bebas** (misal: "Pengadaan SCM PO-123", "Petty cash, nota Toko Maju"). Belum dibuat kolom terstruktur.
4. Tidak ada approval: transaksi langsung tercatat dan stok langsung bertambah.

### Barang yang sudah ada
5. Admin cukup **memilih barang dari katalog** site tersebut dan mengisi **jumlah masuk** (> 0). Detail barang tidak diisi ulang.
6. Stok bertambah sebesar jumlah masuk, tercatat sebagai movement `IN` **dengan jumlahnya**.

### Barang baru
7. Admin mengisi detail barang seperti tambah inventory: nama, unit, jenis (Consumable / Non-Consumable), kategori, deskripsi.
8. Barang otomatis masuk katalog site tersebut dengan **SKU otomatis** (misal `MEGS-GMG-ET-005`) dan stok sesuai jumlah masuk.
9. Tercatat sebagai movement `IN` dengan jumlahnya.

### Tambah inventory langsung (`POST /inventories`)
10. Tetap tersedia untuk **input data awal**.
11. Jika barang dibuat dengan `quantity > 0`, sistem **otomatis mencatat movement `IN`** (stok awal), supaya setiap stok punya jejak.

### Koreksi
12. Salah input jumlah setelah transaksi tersimpan dikoreksi lewat **Adjustment (Case 4)**, bukan dengan mengedit transaksi barang masuk — supaya riwayat tetap utuh.

## Status

Transaksi barang masuk langsung **Selesai** (`COMPLETED`) saat disimpan.

## Dampak teknis (rancangan awal, difinalkan saat coding)

- Stock movement perlu menyimpan **jumlah per barang** (misal tabel item movement: barang, jumlah, stok sebelum, stok sesudah) — dipakai juga oleh Case 1 dan Case 4.
- `POST /inventories` dengan `quantity > 0` membuat movement `IN` dalam **transaksi database yang sama**.
- Barang baru dan movement-nya dibuat **dalam satu transaksi database**: jika salah satu gagal, semua dibatalkan.
