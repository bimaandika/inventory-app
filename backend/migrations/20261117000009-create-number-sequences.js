'use strict';

/**
 * Nomor urut terakhir per awalan nomor transaksi (docs/workflow/nomor-transaksi.md).
 * Contoh baris: prefix = 'IN-GMG-1126', last_number = 3  → nomor berikutnya IN-GMG-1126-004
 * Dipakai oleh services/numberService.js dengan INSERT ... ON CONFLICT supaya aman
 * saat dua transaksi dibuat bersamaan, dan nomor tidak pernah dipakai ulang.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('number_sequences', {
      prefix: { type: Sequelize.STRING(50), primaryKey: true, allowNull: false },
      last_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('number_sequences');
  },
};
