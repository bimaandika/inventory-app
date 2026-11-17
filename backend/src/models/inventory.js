'use strict';
const { Model } = require('sequelize');

/** 1 baris = 1 barang di 1 site. quantity = stok tersedia di site pemilik. */
module.exports = (sequelize, DataTypes) => {
  class Inventory extends Model {
    static associate(models) {
      Inventory.belongsTo(models.Category, { foreignKey: 'categoryId', as: 'category' });
      Inventory.belongsTo(models.Site, { foreignKey: 'siteId', as: 'site' });
      Inventory.hasMany(models.StockMovementItem, { foreignKey: 'inventoryId', as: 'movementItems' });
    }
  }

  Inventory.init(
    {
      name: { type: DataTypes.STRING(150), allowNull: false },
      unit: { type: DataTypes.STRING(30), allowNull: false },
      type: { type: DataTypes.ENUM('CONSUMABLE', 'NON_CONSUMABLE'), allowNull: false },
      description: { type: DataTypes.TEXT, allowNull: true },
      categoryId: { type: DataTypes.INTEGER, allowNull: false },
      siteId: { type: DataTypes.INTEGER, allowNull: false },
      sku: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      image: { type: DataTypes.STRING(255), allowNull: true },
      quantity: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    { sequelize, modelName: 'Inventory', tableName: 'inventories', underscored: true },
  );

  return Inventory;
};
