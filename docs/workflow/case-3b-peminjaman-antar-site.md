# Case 3b — Peminjaman Antar Site

> Status: **Disepakati** (12 November 2026)
> Pengguna: **Admin site** dan **Admin pusat**. Tanpa approval.
> Lihat juga: [Case 3 — Pemindahan inventory](case-3-pemindahan-inventory.md) · [Peran & hak akses](peran-hak-akses.md)

## Ringkasan

Site pemilik meminjamkan barang **non-consumable** ke site lain. **Kepemilikan tetap** di site pemilik dan barang **wajib kembali**.
Selama dipinjam, barang **muncul di katalog site peminjam** (label *"Pinjaman dari …"*, SKU tidak berubah) sehingga crew site peminjam bisa memintanya lewat Case 1.

Perbedaan dengan transfer (Case 3):

| | Transfer (Case 3) | Peminjaman (Case 3b) |
|---|---|---|
| Kepemilikan | Pindah ke site tujuan | **Tetap** di site pemilik |
| SKU | Baru (site tujuan) | **Tidak berubah** |
| Barang yang boleh | Consumable & non-consumable | **Non-consumable saja** |
| Barang kembali? | Tidak | **Wajib** |

## Alur

```
Site pemilik (GMG)                                   Site peminjam (GEG)
──────────────────────────────────────────────────────────────────────────────
1. Admin GMG / pusat: pilih site peminjam,
   barang + jumlah, alasan → "Kirim"
   stok tersedia GMG berkurang
   status: Dalam perjalanan
                                                     2. Admin GEG / pusat: "Terima"
                                                        status: Sedang dipinjam
                                                        → muncul di katalog GEG
                                                          ("Pinjaman dari GMG")
                                                     3. "Kembalikan" (boleh sebagian)
                                                        status: Dalam perjalanan kembali
4. Admin GMG / pusat: "Terima kembali"
   + kondisi per unit (Baik / Rusak / Hilang)
   status: Selesai (bila semua unit kembali)
```

## Status

| Kode | Label di aplikasi | Keterangan |
|---|---|---|
| `IN_TRANSIT` | Dalam perjalanan | Dikirim pemilik, belum diterima peminjam |
| `BORROWED` | Sedang dipinjam | Diterima peminjam; tampil di katalog peminjam |
| `RETURNING` | Dalam perjalanan kembali | Sebagian/seluruh unit dikirim balik, belum diterima pemilik |
| `COMPLETED` | Selesai | Semua unit sudah diterima kembali (dengan kondisinya) |
| `CANCELLED` | Dibatalkan | Hanya saat `IN_TRANSIT`; stok kembali ke pemilik |
| — | — | *Jadikan permanen* → peminjaman ditutup dan diubah menjadi transfer (Case 3) |

## Aturan

### Membuat peminjaman
1. Hanya barang **non-consumable**. Consumable yang dibutuhkan site lain → gunakan **transfer** (Case 3).
2. **Dimulai oleh site pemilik**: admin site pemilik atau admin pusat. Permintaan dari site peminjam terjadi di luar aplikasi (telepon/WA).
3. Satu peminjaman = **satu site pemilik + satu site peminjam**, boleh berisi **banyak barang**.
4. Jumlah tidak boleh melebihi **stok tersedia** di site pemilik.
5. Alasan berupa **teks bebas**.
6. **Tidak ada rencana tanggal kembali** dan tidak ada tanda merah karena lama dipinjam.

### Selama dipinjam
7. **Site pemilik**: barang tetap di katalog; stok tersedia berkurang dan tampil keterangan, misal **"1 dipinjam GEG"**. Crew site pemilik tidak bisa meminta unit yang sedang dipinjamkan.
8. **Site peminjam**: barang tampil di katalog dengan label **"Pinjaman dari GMG"** dan **SKU asli** (label fisik tidak dicetak ulang).
9. Crew site peminjam bisa meminta barang pinjaman lewat **Case 1**; disetujui oleh admin **site peminjam**.

### Pengembalian
10. Dilakukan oleh admin site peminjam atau admin pusat. **Boleh sebagian** (misal pinjam 3, kembali 2 dulu).
11. Hanya unit yang **tidak sedang dipakai crew** (tidak dalam permintaan Case 1 yang aktif) yang bisa dikembalikan.
12. Site pemilik mencatat **kondisi per unit** saat menerima kembali:

    | Kondisi | Efek |
    |---|---|
    | **Baik** | Stok tersedia site pemilik bertambah |
    | **Rusak** | Stok milik site pemilik berkurang; dicatat rusak saat dipinjam site peminjam |
    | **Hilang** | Stok milik site pemilik berkurang; dicatat hilang saat dipinjam site peminjam |

13. Jika barang pinjaman **rusak/hilang saat dipakai crew site peminjam** (dilaporkan di pengembalian Case 1), jumlah pinjaman yang harus kembali ikut berkurang dan stok milik site pemilik berkurang — tercatat terjadi di site peminjam.
14. Peminjaman **Selesai** saat semua unit sudah diterima kembali atau sudah tercatat rusak/hilang.

### Jadikan permanen
15. Jika site peminjam membutuhkan barang seterusnya, admin (pemilik atau pusat) dapat menekan **"Jadikan pemindahan permanen"**: peminjaman ditutup dan unit yang masih dipinjam diubah menjadi **transfer (Case 3)** — SKU baru di site peminjam, tanpa perlu mengembalikan lalu mengirim ulang barang.

### Nomor transaksi
16. Format nomor **akan ditentukan oleh Bima**. Contoh sementara: `PJM-GMG-GEG-20261112-001`.

## Dampak teknis (rancangan awal, difinalkan saat coding)

- Perlu tabel **peminjaman** dan **item peminjaman** (barang, jumlah dipinjam, dikembalikan baik/rusak/hilang).
- Katalog site peminjam = barang milik sendiri **+** barang pinjaman yang sedang `BORROWED`.
- Stok site pemilik perlu membedakan **stok tersedia** dan **stok yang sedang dipinjamkan** (untuk keterangan "1 dipinjam GEG").
- **Stock opname (Case 4)** perlu memperhitungkan barang pinjaman: dihitung fisik di site peminjam, tetapi tetap milik site pemilik.
