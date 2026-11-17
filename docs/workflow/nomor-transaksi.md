# Format Nomor Transaksi

> Status: **Disepakati** (17 November 2026)
> Ditentukan oleh Bima. Berlaku untuk semua jenis transaksi di `stock_movements.number`.

## Format

| Jenis (`type`) | Case | Format | Contoh | Nomor urut dihitung per |
|---|---|---|---|---|
| `REQUEST` — Permintaan barang | 1 | `UTIL-<site>-<MMYY>-<nomor>` | `UTIL-GMG-1126-001` | site + bulan |
| `RETURN` — Pengembalian / laporan sisa | 1 | `<nomor permintaan>-R<urutan>` | `UTIL-GMG-1126-001-R1` | per permintaan |
| `GOODS_IN` — Barang masuk | 2 | `IN-<site>-<MMYY>-<nomor>` | `IN-GMG-1126-001` | site + bulan |
| `TRANSFER` — Pemindahan permanen | 3 | `TF-<site pengirim>-<MMYY>-<nomor>` | `TF-GMG-1126-001` | site pengirim + bulan |
| `LOAN` — Peminjaman antar site | 3b | `LOAN-<site pemberi>-<MMYY>-<nomor>` | `LOAN-GMG-1126-001` | site pemberi + bulan |
| `LOAN_RETURN` — Pengembalian pinjaman | 3b | `<nomor peminjaman>-R<urutan>` | `LOAN-GMG-1126-001-R1` | per peminjaman |
| `ADJUSTMENT` — Adjustment harian | 4 | `ADJ-<site>-<MMYY>-<nomor>` | `ADJ-GMG-1126-001` | site + bulan |
| `OPNAME` — Stock opname | 4 | `OPNAME-<ET/SM>-<site>-<MMYY>-<nomor>` | `OPNAME-SM-GMG-1126-001` | site + jenis barang + bulan |

## Aturan

1. **`<site>`** = kode site (`GMG`, `POMS`, `GEG`, `FOL`, `TRK`, …) dari kolom `sites.code`.
2. **`<MMYY>`** = bulan dan tahun (2 digit) saat transaksi dibuat, menurut **waktu WIB (Asia/Jakarta)**. Contoh: November 2026 → `1126`.
3. **`<nomor>`** = nomor urut minimal 3 digit (`001`, `002`, … `999`, `1000`, …), **kembali ke `001` setiap awal bulan** untuk kombinasi yang sama.
4. **Pengembalian** (`RETURN`, `LOAN_RETURN`) memakai nomor transaksi asalnya ditambah akhiran **`-R1`, `-R2`, …** sesuai urutan pengembalian. Mencari nomor permintaan/peminjaman akan ikut menampilkan pengembaliannya.
5. **`<ET/SM>`** pada opname: `ET` = Non-Consumable, `SM` = Consumable (sama dengan kode jenis di SKU).
6. Nomor yang sudah dipakai **tidak dipakai ulang**, walaupun transaksinya dibatalkan.
7. Nomor dibuat oleh sistem, **tidak bisa diisi atau diubah manual**.
8. Panjang maksimal 50 karakter.

## Kapan nomor dibuat

| Jenis | Saat |
|---|---|
| Permintaan | Crew/admin checkout |
| Pengembalian | Pengembalian diajukan crew atau dicatat admin |
| Barang masuk | Transaksi barang masuk disimpan |
| Transfer / Peminjaman | Admin menekan "Kirim" |
| Pengembalian pinjaman | Admin site peminjam menekan "Kembalikan" |
| Adjustment | Adjustment disimpan |
| Stock opname | Opname dimulai |

## Dampak teknis

- Perlu tabel penghitung nomor urut (mirip `sku_sequences`) supaya aman saat dua transaksi dibuat bersamaan: kunci berupa awalan nomor (misal `UTIL-GMG-1126`) dan nomor terakhirnya.
- Akhiran `-R<urutan>` dihitung dari jumlah pengembalian yang sudah ada untuk transaksi asal, di dalam transaksi database yang mengunci baris transaksi asal.
