'use strict';

/**
 * Nomor urut SKU terakhir per site per jenis barang.
 * Dipakai oleh services/skuService.js dengan INSERT ... ON CONFLICT
 * supaya aman saat dua request bersamaan, dan nomor tidak dipakai ulang.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sku_sequences', {
      site_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        primaryKey: true,
        references: { model: 'sites', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      type: {
        type: Sequelize.ENUM('CONSUMABLE', 'NON_CONSUMABLE'),
        allowNull: false,
        primaryKey: true,
      },
      last_number: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sku_sequences');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_sku_sequences_type";');
  },
};
