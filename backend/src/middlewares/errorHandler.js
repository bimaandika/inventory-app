/*
 * Penanganan error terpusat.
 * Menerjemahkan error Sequelize / PostgreSQL / multer menjadi pesan yang jelas.
 */

/** Pesan untuk constraint UNIQUE (nama constraint dari PostgreSQL). */
const UNIQUE_MESSAGES = {
  users_username_key: 'Username sudah dipakai',
  categories_name_key: 'Nama kategori sudah ada',
  sites_code_key: 'Kode site sudah dipakai site lain',
  inventories_sku_key: 'SKU sudah dipakai barang lain',
  inventories_site_name_unique: 'Barang dengan nama ini sudah ada di site tersebut',
  smi_cart_unique: 'Barang ini sudah ada di keranjang',
  sm_one_active_opname: 'Masih ada stock opname yang berjalan untuk site dan jenis barang ini',
};

/** Pesan untuk constraint CHECK. */
const CHECK_MESSAGES = {
  users_role_site_check: 'Admin pusat tidak boleh punya site; admin site dan crew wajib punya site',
  sites_code_format: 'Kode site hanya boleh huruf besar dan angka, maksimal 10 karakter',
  inventories_quantity_check: 'Stok tidak boleh kurang dari 0',
};

/** Pesan untuk error upload (multer). */
const UPLOAD_MESSAGES = {
  LIMIT_FILE_SIZE: () => `Ukuran foto maksimal ${process.env.UPLOAD_MAX_MB || 2} MB`,
  LIMIT_FILE_COUNT: () => 'Hanya boleh mengunggah 1 foto',
  LIMIT_UNEXPECTED_FILE: () => 'Foto harus dikirim pada field form-data bernama "image"',
};

/** 404 untuk route yang tidak terdaftar. */
function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} tidak ditemukan` });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Error asli PostgreSQL (Sequelize menyimpannya di err.parent / err.original)
  const pg = err.parent || err.original || err;
  const constraint = pg.constraint || err.index;

  // UNIQUE
  if (err.name === 'SequelizeUniqueConstraintError' || pg.code === '23505') {
    return res.status(409).json({
      message: UNIQUE_MESSAGES[constraint] || 'Data sudah ada (duplikat)',
      detail: pg.detail,
    });
  }

  // FOREIGN KEY: hapus data yang masih dipakai → 409, rujukan ke data yang tidak ada → 400
  if (err.name === 'SequelizeForeignKeyConstraintError' || pg.code === '23503') {
    const stillReferenced = /is still referenced/.test(pg.detail || '');
    return res.status(stillReferenced ? 409 : 400).json({
      message: stillReferenced
        ? 'Data tidak bisa dihapus karena masih dipakai oleh data lain'
        : 'Data relasi yang dirujuk tidak ditemukan',
      detail: pg.detail,
    });
  }

  // CHECK
  if (pg.code === '23514') {
    return res.status(400).json({
      message: CHECK_MESSAGES[constraint] || 'Data melanggar aturan validasi',
      detail: constraint,
    });
  }

  // Validasi model Sequelize (allowNull, isIn, dll.)
  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      message: err.errors?.[0]?.message || 'Data tidak valid',
      details: err.errors?.map((e) => ({ field: e.path, message: e.message })),
    });
  }

  // JSON body tidak valid
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Format JSON tidak valid' });
  }

  // Upload foto
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

module.exports = { notFoundHandler, errorHandler };
