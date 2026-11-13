/*
 * Konfigurasi upload foto barang (multer).
 *
 * - Disimpan di backend/uploads/inventories/ dengan nama file acak
 * - Hanya JPG, PNG, WEBP
 * - Ukuran maksimal: UPLOAD_MAX_MB di .env (default 2 MB)
 * - Diakses lewat URL: /uploads/inventories/<nama-file>
 */
import multer from 'multer';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { badRequest } from '../utils/httpError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const UPLOAD_ROOT = path.join(__dirname, '..', '..', 'uploads');
const INVENTORY_DIR = path.join(UPLOAD_ROOT, 'inventories');

export const MAX_UPLOAD_MB = Number(process.env.UPLOAD_MAX_MB) || 2;

const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

fs.mkdirSync(INVENTORY_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, INVENTORY_DIR),
  filename: (req, file, cb) => {
    const name = crypto.randomBytes(16).toString('hex') + ALLOWED_TYPES[file.mimetype];
    cb(null, name);
  },
});

function fileFilter(req, file, cb) {
  if (ALLOWED_TYPES[file.mimetype]) return cb(null, true);
  return cb(badRequest('Format foto harus JPG, PNG, atau WEBP'));
}

/** Middleware: satu file pada field form-data bernama "image". */
export const inventoryImageUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_UPLOAD_MB * 1024 * 1024, files: 1 },
}).single('image');

/** Path yang disimpan di database untuk file yang baru diunggah. */
export const inventoryImagePath = (filename) => `/uploads/inventories/${filename}`;

/**
 * Hapus file foto berdasarkan path yang tersimpan di database
 * (misal "/uploads/inventories/abc.jpg"). Aman: hanya menghapus
 * file di dalam folder uploads, dan tidak error jika file sudah tidak ada.
 */
export function removeUploadedFile(storedPath) {
  if (!storedPath) return;
  const relative = storedPath.replace(/^\/uploads\//, '');
  const fullPath = path.resolve(UPLOAD_ROOT, relative);
  if (!fullPath.startsWith(UPLOAD_ROOT + path.sep)) return;
  fs.promises.unlink(fullPath).catch(() => {});
}
