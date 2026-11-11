/*
 * Generator SKU otomatis.
 * Format : MEGS-<kode site>-<kode jenis>-<nomor urut>
 * Contoh : MEGS-GMG-ET-001
 *
 * - Kode site diambil dari kolom sites.code.
 * - Kode jenis: NON_CONSUMABLE = ET, CONSUMABLE = SM.
 * - Nomor urut dihitung per site per jenis lewat tabel sku_sequences.
 *
 * Panggil di dalam transaksi (withTransaction) bersama INSERT/UPDATE barangnya,
 * supaya nomor tidak "terbuang" kalau penyimpanan barang gagal.
 */
import { badRequest } from '../utils/httpError.js';

export const SKU_PREFIX = 'MEGS';

export const TYPE_CODES = {
  NON_CONSUMABLE: 'ET',
  CONSUMABLE: 'SM',
};

/** Nomor urut minimal 3 digit: 1 → "001", 1000 → "1000". */
export function formatNumber(n) {
  return String(n).padStart(3, '0');
}

/**
 * Ambil nomor urut berikutnya dan susun SKU-nya.
 * @param {import('pg').PoolClient} client — client dari withTransaction
 */
export async function generateSku(client, siteId, type) {
  const typeCode = TYPE_CODES[type];
  if (!typeCode) throw badRequest(`type ${type} tidak dikenal`);

  const site = await client.query('SELECT code FROM sites WHERE id = $1', [siteId]);
  if (!site.rows[0]) throw badRequest('site_id tidak ditemukan');

  // Atomik: baris baru mulai dari 1, baris yang sudah ada ditambah 1.
  const { rows } = await client.query(
    `INSERT INTO sku_sequences (site_id, type, last_number)
     VALUES ($1, $2::inventory_type, 1)
     ON CONFLICT (site_id, type)
     DO UPDATE SET last_number = sku_sequences.last_number + 1
     RETURNING last_number`,
    [siteId, type],
  );

  return `${SKU_PREFIX}-${site.rows[0].code}-${typeCode}-${formatNumber(rows[0].last_number)}`;
}
