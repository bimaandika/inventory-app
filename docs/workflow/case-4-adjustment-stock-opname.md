# Case 4 — Adjustment & Stock Opname

> Status: **Disepakati** (12 November 2026)
> Pengguna: **Admin site** (site sendiri) dan **Admin pusat**.
> Lihat juga: [Peran & hak akses](peran-hak-akses.md)

## Ringkasan

| | Adjustment harian | Stock opname |
|---|---|---|
| Tujuan | Koreksi cepat sehari-hari (rusak, hilang, salah input, ditemukan) | Penghitungan fisik berkala |
| Cakupan | Barang tertentu | Seluruh barang **satu jenis** (Consumable **atau** Non-Consumable) di satu site |
| Approval | **Tanpa approval** | **Admin pusat** |
| Kunci transaksi | Tidak | **Ya**, untuk jenis barang yang diopname di site tersebut |
| Dokumen | — | PDF lembar hitung & PDF laporan |

---

## Bagian 1 — Adjustment harian

```
Admin site / pusat: pilih barang → tambah/kurang jumlah → pilih alasan + catatan → Simpan
                                                                   stok langsung berubah
```

### Aturan
1. Dilakukan oleh **admin site** (site sendiri) atau **admin pusat**. **Tanpa approval.**
2. Alasan berupa **pilihan + catatan bebas**:

   | Alasan | Arah umum |
   |---|---|
   | Rusak | kurang |
   | Hilang | kurang |
   | Koreksi salah input | tambah / kurang |
   | Ditemukan | tambah |
   | Lainnya | tambah / kurang |

3. Input berupa **jumlah tambah atau kurang** per barang (misal −2). Stok **tidak boleh minus**.
4. Satu adjustment boleh berisi **banyak barang**, dengan alasan **per barang**.
5. Tercatat di stock movement `ADJUSTMENT` beserta stok sebelum & sesudah.
6. Dipakai juga untuk koreksi dari case lain (salah input barang masuk di Case 2, selisih/kerusakan transfer di Case 3).
7. Tidak bisa dilakukan untuk jenis barang yang sedang **diopname** di site tersebut.

---

## Bagian 2 — Stock opname

```
Admin site                                          Admin pusat
──────────────────────────────────────────────────────────────────────────
1. Mulai opname: pilih site + jenis
   (Consumable / Non-Consumable)
   → "stok sebelum" dicatat, transaksi jenis
     tersebut di site ini dikunci
2. Unduh PDF lembar hitung → hitung fisik
3. Input hasil (boleh disimpan bertahap)
   + catatan wajib untuk yang selisih
4. Ajukan ─────────────────────────────────────────► 5. Periksa selisih:
                                                       • Setujui → stok diperbarui, kunci dibuka
                                                       • Kembalikan + catatan → hitung ulang
6. Unduh PDF laporan
```

### Status

| Kode | Label di aplikasi | Keterangan |
|---|---|---|
| `IN_PROGRESS` | Sedang dihitung | Transaksi jenis terkait di site dikunci; hasil bisa disimpan bertahap |
| `SUBMITTED` | Menunggu persetujuan | Diajukan ke admin pusat; masih terkunci |
| `APPROVED` | Disetujui | Stok diperbarui; kunci dibuka; laporan tersedia |
| `CANCELLED` | Dibatalkan | Kunci dibuka; stok tidak berubah |

"Kembalikan" oleh admin pusat mengubah status `SUBMITTED` → `IN_PROGRESS` dengan catatan.

### Aturan

#### Cakupan
1. Satu opname = **satu site + satu jenis barang** (Consumable **atau** Non-Consumable), seluruh barang jenis tersebut. Opname non-consumable bisa dijadwalkan lebih jarang daripada consumable.
2. Dalam satu waktu hanya boleh **satu opname aktif per site per jenis** (opname consumable dan non-consumable di site yang sama boleh berjalan bersamaan).
3. Dimulai oleh **admin site** (site sendiri) atau **admin pusat**.

#### Penguncian transaksi
4. Selama opname `IN_PROGRESS` / `SUBMITTED`, semua aksi yang **mengubah stok barang jenis tersebut di site tersebut ditahan**: setujui permintaan, tandai diambil, terima pengembalian, barang masuk, kirim/terima transfer, kirim/terima/kembalikan peminjaman, adjustment harian.
5. Transaksi yang berisi **campuran** jenis (misal permintaan Case 1 berisi consumable & non-consumable) ditahan bila **ada satu saja** barangnya terkunci.
6. Crew **tetap bisa** melihat katalog dan mengajukan permintaan; persetujuannya menunggu opname selesai.
7. Aplikasi menampilkan banner, misal *"Site GMG sedang stock opname Consumable"*.

#### Lembar hitung (PDF)
8. Berisi SKU, nama, unit, dan kolom kosong **Jumlah fisik** & **Catatan**, dikelompokkan per kategori.
9. **Stok sistem disembunyikan** (*blind count*).
10. Barang yang tidak sedang di gudang diperlakukan sebagai berikut (sistem yang memperhitungkan, petugas cukup menghitung yang ada di depan mata):

    | Kondisi barang | Perlakuan |
    |---|---|
    | Disetujui tetapi belum diambil crew (Case 1) | Masih di gudang → **dihitung** |
    | Sedang dibawa crew (Case 1) | Tidak dihitung; tercantum sebagai info |
    | Dipinjamkan ke site lain (Case 3b, non-consumable) | Tidak dihitung; tercantum sebagai info |
    | Pinjaman dari site lain (Case 3b, non-consumable) | **Dihitung** di bagian terpisah "Barang pinjaman" |
    | Dalam perjalanan (transfer / peminjaman) | Tidak dihitung; tercantum sebagai info |

#### Input & pengajuan
11. Hasil hitung bisa **disimpan sebagai draf** selama proses.
12. **Semua barang wajib diisi** sebelum diajukan.
13. Barang dengan **selisih wajib diberi catatan**.

#### Persetujuan admin pusat
14. **Setujui** → stok diperbarui sesuai hasil hitung, tercatat di stock movement (stok sebelum, sesudah, selisih), kunci dibuka.
15. **Kembalikan** + catatan → kembali ke `IN_PROGRESS` untuk dihitung ulang.
16. Jika **admin pusat sendiri** yang melakukan opname, hasilnya **langsung berlaku** saat diajukan.
17. Opname bisa **dibatalkan** (oleh pembuat atau admin pusat); kunci dibuka, stok tidak berubah.

#### Laporan (PDF)
18. Berisi: site, jenis, tanggal mulai & selesai, petugas, penyetuju; tabel **SKU, nama, stok sebelum, stok fisik, selisih, catatan**; ringkasan (jumlah barang sesuai / lebih / kurang); kolom tanda tangan manual.
19. **Riwayat opname** per site tersimpan; laporan bisa diunduh ulang kapan saja.

#### Nomor transaksi
20. Nomor adjustment dan opname: **format ditentukan Bima** (lihat [Peran & hak akses](peran-hak-akses.md#nomor-transaksi)).

## Dampak teknis (rancangan awal, difinalkan saat coding)

- Tabel **sesi opname** (site, jenis, status, petugas, penyetuju, waktu) dan **item opname** (barang, stok sebelum, stok fisik, selisih, catatan).
- Pemeriksaan **kunci opname** dipakai bersama oleh semua aksi yang mengubah stok (Case 1, 2, 3, 3b, adjustment).
- "Stok sebelum" yang dibandingkan dengan hitung fisik = stok tersedia **+** jumlah yang disetujui tetapi belum diambil (karena stok sudah berkurang saat disetujui, sementara barangnya masih di gudang).
- Generator **PDF** di backend untuk lembar hitung dan laporan.
