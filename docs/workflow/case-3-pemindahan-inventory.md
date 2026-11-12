# Case 3 — Pemindahan Inventory (Transfer Antar Site)

> Status: **Disepakati** (12 November 2026)
> Pengguna: **Admin site** dan **Admin pusat**. Tanpa approval; diganti **konfirmasi penerimaan** di site tujuan.
> Lihat juga: [Peran & hak akses](peran-hak-akses.md)

## Ringkasan

Barang dipindahkan **secara permanen** dari satu site ke site lain (kepemilikan berpindah).
Prosesnya **dua langkah**: **Kirim** di site asal → **Terima** di site tujuan.
Peminjaman antar site (barang kembali lagi) **belum didukung**; jika barang perlu kembali, buat transfer balik.

## Alur

```
Admin site asal / pusat           Site asal (GMG)     Site tujuan (TRK)     Admin site tujuan / pusat
─────────────────────────────────────────────────────────────────────────────────────────────────────
1. Pilih site asal & tujuan
2. Pilih barang + jumlah
   (keranjang transfer)
3. Lihat pratinjau SKU tujuan
4. Isi alasan → "Kirim" ───────► stok berkurang
                                 status: Dalam perjalanan
                                                     5. Barang sampai → "Terima"
                                                        stok bertambah ◄──────
```

## Status

| Kode | Label di aplikasi | Keterangan |
|---|---|---|
| `IN_TRANSIT` | Dalam perjalanan | Setelah "Kirim"; stok site asal sudah berkurang, belum masuk site tujuan |
| `COMPLETED` | Diterima | Setelah "Terima"; stok site tujuan bertambah |
| `CANCELLED` | Dibatalkan | Hanya saat `IN_TRANSIT`; stok kembali ke site asal |

## Aturan

### Transfer
1. Hanya **pemindahan permanen**. Peminjaman antar site ditunda.
2. Satu transfer = **satu site asal + satu site tujuan**, boleh berisi **banyak barang**.
3. Jumlah per barang tidak boleh melebihi **stok tersedia** di site asal. Boleh memindahkan sebagian (misal 2 dari 5).
4. Alasan berupa **teks bebas**.
5. Nomor transfer: **`TRF-<site asal>-<site tujuan>-<YYYYMMDD>-<nomor urut harian>`**, contoh `TRF-GMG-TRK-20261112-001`.

### Barang di site tujuan
6. Jika site tujuan **sudah punya barang dengan nama yang sama** (tidak peka huruf besar/kecil) → stok **ditambahkan** ke barang tersebut.
7. Jika **belum ada** → sistem **membuat barang baru** di site tujuan dengan detail yang sama (nama, unit, jenis, kategori, deskripsi) dan **SKU baru** sesuai site tujuan (misal `MEGS-GMG-ET-002` → `MEGS-TRK-ET-004`). SKU dibuat saat barang **diterima**.
8. **Label SKU fisik perlu dicetak ulang** untuk barang yang mendapat SKU baru.
9. **Foto kondisi ikut disalin** ke barang baru di site tujuan; bisa diganti kemudian.
10. Sebelum "Kirim", admin melihat **pratinjau** per barang: *"Ditambahkan ke MEGS-TRK-ET-001"* atau *"Dibuat baru di TRK (SKU dibuat saat diterima)"*.

### Kirim & terima
11. **Kirim**: oleh **admin site asal** atau **admin pusat**. Stok site asal langsung berkurang.
12. **Terima**: oleh **admin site tujuan** atau **admin pusat**. Admin pusat boleh mengirim **dan** menerima transfer yang sama (misal site baru yang belum punya admin).
13. Penerimaan **sesuai jumlah yang dikirim**, boleh disertai **catatan**. Jika ada selisih/kerusakan dalam perjalanan, dikoreksi lewat **Adjustment (Case 4)**.
14. Selama `IN_TRANSIT`, barang **tidak terhitung** di stok site mana pun.
15. **Pembatalan** hanya selama `IN_TRANSIT`, oleh admin site asal atau admin pusat; stok kembali ke site asal.
16. `IN_TRANSIT` lebih dari **3 hari** → **tanda merah**.

### Ditunda
- Peminjaman antar site.
- Cetak **surat jalan (PDF)**.

## Dampak teknis (rancangan awal, difinalkan saat coding)

- Jenis movement **`TRANSFER`** dibutuhkan (sebelumnya ditunda): mencatat keluar di site asal dan masuk di site tujuan, terhubung ke satu nomor transfer.
- Movement transfer perlu kolom **site asal** dan **site tujuan**.
- Pembuatan barang baru di site tujuan + SKU + penambahan stok dilakukan **dalam satu transaksi database** saat "Terima".
- Salin file foto (bukan berbagi file yang sama), supaya mengganti/menghapus foto di satu site tidak memengaruhi site lain.
