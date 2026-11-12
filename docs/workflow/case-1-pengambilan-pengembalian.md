# Case 1 — Pengambilan & Pengembalian Barang

> Status: **Disepakati** (11 November 2026)
> Pengguna: **Admin** dan **Crew**. Tidak ada approval berjenjang; semua persetujuan oleh admin.
> **Admin** di dokumen ini = admin site (untuk site-nya sendiri) atau admin pusat. Lihat [Peran & hak akses](peran-hak-akses.md).

## Ringkasan

Crew meminta barang **consumable** (material) dan **non-consumable** (alat) dalam **satu keranjang**.
Setelah disetujui admin dan diambil, **non-consumable wajib dikembalikan** dan **sisa consumable dilaporkan**.

Contoh: crew meminta 1 gerinda tangan (non-consumable) + 5 mata gerinda (consumable).
Saat pengembalian, gerinda dikembalikan dan dilaporkan sisa mata gerinda 2 → stok mata gerinda +2, terpakai 3.

## Alur

```
Crew                              Admin                               Stok
──────────────────────────────────────────────────────────────────────────────
1. Buka katalog (site sendiri)
2. Masukkan ke keranjang
3. Checkout + alasan   ─────────► Menunggu persetujuan
                                  4. Setujui (boleh ubah jumlah /  ─► berkurang
                                     coret item) atau Tolak + alasan
                                  5. Serahkan barang
   (admin ATAU crew menekan "Sudah diambil")
6. Kembalikan non-consumable /
   laporkan sisa consumable ────► 7. Konfirmasi penerimaan  ─────────► bertambah*
                                  Selesai otomatis bila semua beres
```
\* sesuai kondisi barang, lihat bagian Pengembalian.

## Status

| Kode | Label di aplikasi | Keterangan |
|---|---|---|
| `PENDING` | Menunggu persetujuan | Setelah checkout |
| `APPROVED` | Disetujui, siap diambil | Stok sudah terpotong |
| `PICKED_UP` | Sudah diambil | Ditandai oleh admin **atau** crew |
| `COMPLETED` | Selesai | Otomatis saat semua non-consumable kembali & semua consumable dilaporkan |
| `REJECTED` | Ditolak | Wajib ada alasan dari admin |
| `CANCELLED` | Dibatalkan | Oleh crew (saat `PENDING`) atau admin (saat `PENDING`/`APPROVED`) |

## Aturan

### Permintaan
1. Consumable dan non-consumable boleh dalam **satu keranjang**. Istilah di aplikasi tetap **Consumable / Non-Consumable**.
2. Crew hanya melihat dan meminta barang di **site-nya sendiri**.
3. **Admin bisa membuat permintaan atas nama crew** (pilih nama crew); permintaan ini langsung berstatus `APPROVED`.

### Katalog & keranjang
4. Katalog menampilkan foto, nama, SKU, jenis, dan **jumlah tersedia**. Stok 0 tetap tampil dengan label **"Habis"** dan tidak bisa dimasukkan ke keranjang.
5. Jumlah di keranjang tidak boleh melebihi stok tersedia.
6. Barang yang sama dimasukkan dua kali → **jumlahnya digabung**.
7. Isi keranjang **tetap tersimpan** walaupun aplikasi ditutup.

### Checkout
8. Alasan berupa **pilihan** (Pemakaian harian / Perbaikan / Proyek / Lainnya) **+ catatan bebas**.
9. Nomor permintaan: contoh `REQ-GMG-20261111-001`. *(format sementara — format final ditentukan Bima)*
10. Crew bisa **membatalkan** selama status masih `PENDING`.

### Persetujuan (admin)
11. Admin boleh **mengurangi jumlah per item** atau **mencoret item** sebelum menyetujui.
12. Menolak **wajib disertai alasan**.
13. **Stok berkurang saat disetujui.** Jika kemudian dibatalkan, stok dikembalikan.

### Pengambilan
14. **Admin atau crew** bisa menandai "Sudah diambil" — crew tidak wajib membuka aplikasi.
15. Jumlah yang diambil = jumlah yang disetujui.
16. Status `APPROVED` lebih dari **3 hari** → **tanda merah** di daftar admin. Pembatalan tetap **manual oleh admin** (tidak otomatis).

### Pengembalian
17. Pengembalian bisa **diajukan crew** lalu dikonfirmasi admin, **atau langsung dicatat admin** saat barang diserahkan.
18. Boleh **bertahap** (misal hari ini alat kembali, besok sisa material dilaporkan), tetapi total tidak boleh melebihi jumlah yang diambil.
19. **Non-consumable** — setiap unit dicatat kondisinya:

    | Kondisi | Efek ke stok | Catatan |
    |---|---|---|
    | **Baik** | Kembali ke stok | |
    | **Rusak** | **Tidak** kembali ke stok | Dicatat sebagai barang rusak untuk ditindaklanjuti |
    | **Hilang** | **Tidak** kembali ke stok | Tercatat siapa yang terakhir memegang |

20. **Consumable** — dilaporkan **jumlah sisa** (boleh 0). Sisa kembali ke stok; selisihnya tercatat sebagai **terpakai**.
21. Permintaan **otomatis `COMPLETED`** ketika seluruh non-consumable sudah dicatat kondisinya dan seluruh consumable sudah dilaporkan sisanya.
22. Status `PICKED_UP` lebih dari **7 hari** belum selesai → **tanda merah** di daftar admin (berlaku untuk semua permintaan, termasuk yang berisi non-consumable). Tidak ada batas tanggal kembali per alat.

### Kemudahan penggunaan
23. Setiap permintaan punya **timeline** (siapa melakukan apa dan kapan).
24. Notifikasi tahap awal berupa **badge angka di aplikasi** (admin: menunggu persetujuan / perlu tindak lanjut; crew: siap diambil). WA/email menyusul.

## Dampak teknis (rancangan awal, difinalkan saat coding)

- Per item perlu dicatat: jumlah **diminta**, **disetujui**, dan untuk pengembalian: **kembali baik**, **rusak**, **hilang** (non-consumable) atau **sisa** dan **terpakai** (consumable).
- Pengembalian bertahap → perlu tabel **riwayat pengembalian** per permintaan.
- Barang **rusak** perlu tempat pencatatan (misal jumlah rusak per barang) untuk ditindaklanjuti di case lain (perbaikan / penghapusan).
- Keputusan sebelumnya **"crew tidak bisa meminta non-consumable lewat cart" dibatalkan** oleh dokumen ini.
- Approval berjenjang (coordinator/manager) **tidak dipakai** di semua case untuk saat ini.
