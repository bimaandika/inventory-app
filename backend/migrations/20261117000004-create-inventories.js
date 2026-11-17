'use strict';

/**
 * Barang per site: 1 baris = 1 barang di 1 site.
 * - sku unik, dibuat otomatis (MEGS-<site>-<ET|SM>-<nomor>)
 * - nama barang unik per site (tidak peka huruf besar/kecil)
 * - quantity = stok tersedia di site pemilik
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventories', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(150), allowNull: false },
      unit: { type: Sequelize.STRING(30), allowNull: false },
      type: { type: Sequelize.ENUM('CONSUMABLE', 'NON_CONSUMABLE'), allowNull: false },
      description: { type: Sequelize.TEXT, allowNull: true },
      category_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'categories', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      site_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'sites', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      sku: { type: Sequelize.STRING(50), allowNull: false, unique: true },
      image: { type: Sequelize.STRING(255), allowNull: true },
      quantity: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.addIndex('inventories', ['site_id']);
    await queryInterface.addIndex('inventories', ['category_id']);
    await queryInterface.addIndex('inventories', ['type']);
    await queryInterface.addIndex('inventories', ['is_active']);

    await queryInterface.sequelize.query(`
      ALTER TABLE inventories ADD CONSTRAINT inventories_quantity_check CHECK (quantity >= 0);
      CREATE UNIQUE INDEX inventories_site_name_unique ON inventories (site_id, LOWER(name));
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('inventories');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_inventories_type";');
  },
};
