'use strict';

/** Site / lokasi. `code` dipakai di SKU: MEGS-<code>-ET-001 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('sites', {
      id: { type: Sequelize.INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      code: { type: Sequelize.STRING(10), allowNull: false, unique: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE sites
        ADD CONSTRAINT sites_code_format CHECK (code ~ '^[A-Z0-9]{1,10}$');
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('sites');
  },
};
