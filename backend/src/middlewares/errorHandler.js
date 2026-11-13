/** Pesan yang lebih jelas untuk constraint UNIQUE tertentu. */
const UNIQUE_MESSAGES = {
  users_username_key: 'Username sudah dipakai',
  categories_name_key: 'Nama kategori sudah ada',
  sites_code_unique: 'Kode site sudah dipakai site lain',
  inventories_sku_unique: 'SKU sudah dipakai barang lain',
  inventories_site_name_unique: 'Barang dengan nama ini sudah ada di site tersebut',
};

/** Pesan yang lebih jelas untuk constraint CHECK tertentu. */
const CHECK_MESSAGES = {
  users_role_site_check: 'Admin pusat tidak boleh punya site; admin site dan crew wajib punya site',
  sites_code_format: 'Kode site hanya boleh huruf besar dan angka, maksimal 10 karakter',
};

/** Pesan untuk error upload (multer). */
const UPLOAD_MESSAGES = {
  LIMIT_FILE_SIZE: () => `Ukuran foto maksimal ${process.env.UPLOAD_MAX_MB || 2} MB`,
  LIMIT_FILE_COUNT: () => 'Hanya boleh mengunggah 1 foto',
  LIMIT_UNEXPECTED_FILE: () => 'Foto harus dikirim pada field form-data bernama "image"',
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
    return res.status(400).json({
      message: CHECK_MESSAGES[err.constraint] || 'Data melanggar aturan validasi',
      detail: err.constraint,
    });
  }
  // Error upload foto
  if (err.name === 'MulterError') {
    const message = UPLOAD_MESSAGES[err.code]?.() || `Upload gagal: ${err.message}`;
    return res.status(400).json({ message });
  }

  const status = err.status || 500;
  if (status >= 500) console.error(err);

  return res.status(status).json({
    message: status >= 500 ? 'Terjadi kesalahan pada server' : err.message,
    ...(err.details && { details: err.details }),
  });
}
