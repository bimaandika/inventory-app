/*
 * Generator SKU otomatis.
 * Format : MEGS-<kode site>-<kode jenis>-<nomor urut>
 * Contoh : MEGS-GMG-ET-001
 *
 * - Kode site dari kolom sites.code
 * - Kode jenis: NON_CONSUMABLE = ET, CONSUMABLE = SM
 * - Nomor urut per site per jenis (tabel sku_sequences), minimal 3 digit
 *
 * Panggil DI DALAM transaksi bersama penyimpanan barangnya, supaya nomor
 * tidak "terbuang" kalau penyimpanan barang gagal.
 */
const { sequelize, Site } = require('../models');
const { badRequest } = require('../helpers/httpError');

const SKU_PREFIX = 'MEGS';

const TYPE_CODES = {
  NON_CONSUMABLE: 'ET',
  CONSUMABLE: 'SM',
};

/** 1 → "001", 1000 → "1000" */
const formatNumber = (n) => String(n).padStart(3, '0');

/**
 * Ambil nomor urut berikutnya dan susun SKU-nya.
 * @param {string} type        CONSUMABLE | NON_CONSUMABLE
 * @param {object} transaction transaksi Sequelize
 */
async function generateSku(siteId, type, transaction) {
  const typeCode = TYPE_CODES[type];
  if (!typeCode) throw badRequest(`type ${type} tidak dikenal`);

  const site = await Site.findByPk(siteId, { attributes: ['code'], transaction });
  if (!site) throw badRequest('site_id tidak ditemukan');

  // Atomik: baris baru mulai dari 1, baris yang sudah ada ditambah 1.
  const [rows] = await sequelize.query(
    `INSERT INTO sku_sequences (site_id, type, last_number)
     VALUES (:siteId, :type, 1)
     ON CONFLICT (site_id, type)
     DO UPDATE SET last_number = sku_sequences.last_number + 1
     RETURNING last_number`,
    { replacements: { siteId, type }, transaction },
  );

  return `${SKU_PREFIX}-${site.code}-${typeCode}-${formatNumber(rows[0].last_number)}`;
}

module.exports = { SKU_PREFIX, TYPE_CODES, formatNumber, generateSku };
