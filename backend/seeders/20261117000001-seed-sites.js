'use strict';

/** 5 site utama beserta kodenya (dipakai di SKU). Aman dijalankan berulang. */
const SITES = [
  { name: 'Gunung Megang', code: 'GMG' },
  { name: 'POMS Rimau', code: 'POMS' },
  { name: 'GEG Rimau', code: 'GEG' },
  { name: 'FOL', code: 'FOL' },
  { name: 'Genset Tarakan', code: 'TRK' },
];

module.exports = {
  async up(queryInterface) {
    const now = new Date();
    await queryInterface.bulkInsert(
      'sites',
      SITES.map((s) => ({ ...s, created_at: now, updated_at: now })),
      { ignoreDuplicates: true }, // ON CONFLICT DO NOTHING
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('sites', {
      code: { [Sequelize.Op.in]: SITES.map((s) => s.code) },
    });
  },
};
