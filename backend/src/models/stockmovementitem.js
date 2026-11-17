'use strict';
const { Model } = require('sequelize');

/**
 * Item semua jenis transaksi + isi keranjang (movementId NULL).
 * Arti kolom qty_* tergantung jenis transaksi (lihat docs/erd.md).
 */
module.exports = (sequelize, DataTypes) => {
  class StockMovementItem extends Model {
    static associate(models) {
      StockMovementItem.belongsTo(models.StockMovement, { foreignKey: 'movementId', as: 'movement' });
      StockMovementItem.belongsTo(models.Inventory, { foreignKey: 'inventoryId', as: 'inventory' });
      StockMovementItem.belongsTo(models.Inventory, { foreignKey: 'destInventoryId', as: 'destInventory' });
      StockMovementItem.belongsTo(models.User, { foreignKey: 'idUser', as: 'owner' });
      StockMovementItem.belongsTo(StockMovementItem, { foreignKey: 'refItemId', as: 'refItem' });
      StockMovementItem.hasMany(StockMovementItem, { foreignKey: 'refItemId', as: 'childItems' });
    }
  }

  const qty = { type: DataTypes.INTEGER, allowNull: true };

  StockMovementItem.init(
    {
      movementId: { type: DataTypes.INTEGER, allowNull: true },
      idUser: { type: DataTypes.INTEGER, allowNull: true },
      inventoryId: { type: DataTypes.INTEGER, allowNull: false },
      destInventoryId: { type: DataTypes.INTEGER, allowNull: true },
      refItemId: { type: DataTypes.INTEGER, allowNull: true },
      quantity: qty,
      qtyApproved: qty,
      qtyGood: qty,
      qtyDamaged: qty,
      qtyLost: qty,
      qtyUsed: qty,
      qtyBefore: qty,
      qtyAfter: qty,
      reason: { type: DataTypes.STRING(30), allowNull: true },
      note: { type: DataTypes.TEXT, allowNull: true },
    },
    {
      sequelize,
      modelName: 'StockMovementItem',
      tableName: 'stock_movement_items',
      underscored: true,
    },
  );

  return StockMovementItem;
};
