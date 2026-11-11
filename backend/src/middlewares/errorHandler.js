/** Pesan yang lebih jelas untuk constraint UNIQUE tertentu. */
const UNIQUE_MESSAGES = {
  users_username_key: 'Username sudah dipakai',
  categories_name_key: 'Nama kategori sudah ada',
  inventories_sku_unique: 'SKU sudah dipakai barang lain',
  inventories_site_name_unique: 'Barang dengan nama ini sudah ada di site tersebut',
};

/** 404 untuk route yang tidak terdaftar. */
export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} tidak ditemukan` });
}

/** Penanganan error terpusat. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Pelanggaran constraint PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({
      message: UNIQUE_MESSAGES[err.constraint] || 'Data sudah ada (duplikat)',
      detail: err.detail,
    });
  }
  if (err.code === '23503') {
    // Hapus data yang masih dipakai → 409, referensi ke data yang tidak ada → 400
    const stillReferenced = /is still referenced/.test(err.detail || '');
    return res.status(stillReferenced ? 409 : 400).json({
      message: stillReferenced
        ? 'Data tidak bisa dihapus karena masih dipakai oleh data lain'
        : 'Data relasi yang dirujuk tidak ditemukan',
      detail: err.detail,
    });
  }
  // JSON body tidak valid
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Format JSON tidak valid' });
  }
  if (err.code === '23514') {
    return res.status(400).json({ message: 'Data melanggar aturan validasi', detail: err.constraint });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);

  return res.status(status).json({
    message: status >= 500 ? 'Terjadi kesalahan pada server' : err.message,
    ...(err.details && { details: err.details }),
  });
}
