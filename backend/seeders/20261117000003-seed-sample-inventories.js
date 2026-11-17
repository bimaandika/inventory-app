'use strict';

/**
 * DATA SAMPLE — kategori & barang untuk development/testing.
 * Disimpan 17 November 2026 dari data yang diinput Bima.
 *
 * - Site dirujuk lewat KODE (GMG, POMS, GEG) dan kategori lewat NAMA,
 *   bukan id angka, supaya tetap cocok setelah database dibuat ulang.
 * - SKU disimpan sama seperti aslinya; tabel sku_sequences ikut disesuaikan
 *   supaya barang baru berikutnya melanjutkan nomor urut (tidak bentrok).
 * - Aman dijalankan berulang: kategori/barang yang sudah ada dilewati.
 * - TIDAK dijalankan saat NODE_ENV=production.
 *
 * Catatan: quantity diisi langsung sebagai stok awal (belum tercatat
 * di stock movement). Setelah fitur barang masuk (Case 2) selesai,
 * stok awal sample bisa dicatat ulang lewat fitur tersebut bila perlu.
 */

const CATEGORIES = ['Handy Tools', 'Material Welding', 'Instrument Plant', 'Sparepart G3516'];

const INVENTORIES = [
  // ---- Gunung Megang (GMG)
  { site: 'GMG', category: 'Handy Tools', sku: 'MEGS-GMG-ET-001', name: 'Kunci Oil Filter Tekiro', unit: 'ea', type: 'NON_CONSUMABLE', quantity: 1 },
  { site: 'GMG', category: 'Handy Tools', sku: 'MEGS-GMG-ET-002', name: 'Multimeter Fluke', unit: 'ea', type: 'NON_CONSUMABLE', quantity: 3 },
  { site: 'GMG', category: 'Handy Tools', sku: 'MEGS-GMG-ET-003', name: 'Grease Valve High Temp & Pressure', unit: 'ea', type: 'NON_CONSUMABLE', quantity: 1 },
  { site: 'GMG', category: 'Instrument Plant', sku: 'MEGS-GMG-SM-001', name: 'Barton Chart', unit: 'ea', type: 'CONSUMABLE', quantity: 100 },

  // ---- POMS Rimau (POMS)
  { site: 'POMS', category: 'Handy Tools', sku: 'MEGS-POMS-ET-001', name: 'Kamera WG.80', unit: 'unit', type: 'NON_CONSUMABLE', quantity: 1 },
  { site: 'POMS', category: 'Handy Tools', sku: 'MEGS-POMS-ET-002', name: 'Roll Meter 100m', unit: 'ea', type: 'NON_CONSUMABLE', quantity: 1 },
  { site: 'POMS', category: 'Material Welding', sku: 'MEGS-POMS-SM-001', name: 'Mata Gerinda 6"', unit: 'pcs', type: 'CONSUMABLE', quantity: 50 },

  // ---- GEG Rimau (GEG)
  { site: 'GEG', category: 'Sparepart G3516', sku: 'MEGS-GEG-SM-001', name: 'HP427 Bottle', unit: 'botol', type: 'CONSUMABLE', quantity: 23 },
  { site: 'GEG', category: 'Sparepart G3516', sku: 'MEGS-GEG-SM-002', name: 'Spark Plug', unit: 'ea', type: 'CONSUMABLE', quantity: 12 },
  { site: 'GEG', category: 'Handy Tools', sku: 'MEGS-GEG-ET-001', name: 'Wilden Pump Diaphragma', unit: 'unit', type: 'NON_CONSUMABLE', quantity: 2 },
];

module.exports = {
  async up(queryInterface) {
    if (process.env.NODE_ENV === 'production') {
      console.log('• Data sample dilewati (NODE_ENV=production)');
      return;
    }
    const now = new Date();
    const { sequelize } = queryInterface;

    // 1. Kategori
    await queryInterface.bulkInsert(
      'categories',
      CATEGORIES.map((name) => ({ name, created_at: now, updated_at: now })),
      { ignoreDuplicates: true },
    );

    // 2. Ambil id site & kategori berdasarkan kode / nama
    const [sites] = await sequelize.query('SELECT id, code FROM sites');
    const [categories] = await sequelize.query('SELECT id, name FROM categories');
    const siteId = Object.fromEntries(sites.map((s) => [s.code, s.id]));
    const categoryId = Object.fromEntries(categories.map((c) => [c.name, c.id]));

    const missingSites = [...new Set(INVENTORIES.map((i) => i.site))].filter((code) => !siteId[code]);
    if (missingSites.length) {
      throw new Error(`Site ${missingSites.join(', ')} belum ada. Jalankan seeder site terlebih dahulu.`);
    }

    // 3. Barang (SKU yang sudah ada dilewati)
    await queryInterface.bulkInsert(
      'inventories',
      INVENTORIES.map((i) => ({
        name: i.name,
        unit: i.unit,
        type: i.type,
        description: null,
        category_id: categoryId[i.category],
        site_id: siteId[i.site],
        sku: i.sku,
        image: null,
        quantity: i.quantity,
        is_active: true,
        created_at: now,
        updated_at: now,
      })),
      { ignoreDuplicates: true },
    );

    // 4. Samakan nomor urut SKU dengan SKU tertinggi yang sudah ada,
    //    supaya barang baru berikutnya tidak memakai nomor yang sama.
    await sequelize.query(`
      INSERT INTO sku_sequences (site_id, type, last_number)
      SELECT site_id,
             type::text::"enum_sku_sequences_type",
             MAX(CAST(split_part(sku, '-', 4) AS INTEGER))
        FROM inventories
       WHERE sku ~ '^MEGS-[A-Z0-9]+-(ET|SM)-[0-9]+$'
       GROUP BY site_id, type
      ON CONFLICT (site_id, type)
      DO UPDATE SET last_number = GREATEST(sku_sequences.last_number, EXCLUDED.last_number);
    `);
  },

  async down(queryInterface, Sequelize) {
    const { Op } = Sequelize;
    await queryInterface.bulkDelete('inventories', { sku: { [Op.in]: INVENTORIES.map((i) => i.sku) } });
    // Kategori hanya dihapus jika tidak dipakai barang lain
    await queryInterface.sequelize.query(
      `DELETE FROM categories c
        WHERE c.name IN (:names)
          AND NOT EXISTS (SELECT 1 FROM inventories i WHERE i.category_id = c.id)`,
      { replacements: { names: CATEGORIES } },
    );
  },
};
