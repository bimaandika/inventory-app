/** 404 untuk route yang tidak terdaftar. */
export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} tidak ditemukan` });
}

/** Penanganan error terpusat. */
// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  // Pelanggaran constraint PostgreSQL
  if (err.code === '23505') {
    return res.status(409).json({ message: 'Data sudah ada (duplikat)', detail: err.detail });
  }
  if (err.code === '23503') {
    return res.status(409).json({ message: 'Data masih direferensikan oleh data lain', detail: err.detail });
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
