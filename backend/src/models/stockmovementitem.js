'use strict';
const { Model } = require('sequelize');

/**
 * Item semua jenis transaksi + isi keranjang (movement_id NULL).
 * Arti kolom qty_* tergantung jenis transaksi (lihat docs/erd.md).
 */
module.exports = (sequelize, DataTypes) => {
  class StockMovementItem extends Model {
    static associate(models) {
      StockMovementItem.belongsTo(models.StockMovement, { foreignKey: 'movement_id', as: 'movement' });
      StockMovementItem.belongsTo(models.Inventory, { foreignKey: 'inventory_id', as: 'inventory' });
      StockMovementItem.belongsTo(models.Inventory, { foreignKey: 'dest_inventory_id', as: 'destInventory' });
      StockMovementItem.belongsTo(models.User, { foreignKey: 'id_user', as: 'owner' });
      StockMovementItem.belongsTo(StockMovementItem, { foreignKey: 'ref_item_id', as: 'refItem' });
      StockMovementItem.hasMany(StockMovementItem, { foreignKey: 'ref_item_id', as: 'childItems' });
    }
  }

  const qty = { type: DataTypes.INTEGER, allowNull: true };

  StockMovementItem.init(
    {
      movement_id: { type: DataTypes.INTEGER, allowNull: true },
      id_user: { type: DataTypes.INTEGER, allowNull: true },
      inventory_id: { type: DataTypes.INTEGER, allowNull: false },
      dest_inventory_id: { type: DataTypes.INTEGER, allowNull: true },
      ref_item_id: { type: DataTypes.INTEGER, allowNull: true },
      quantity: qty,
      qty_approved: qty,
      qty_good: qty,
      qty_damaged: qty,
      qty_lost: qty,
      qty_used: qty,
      qty_before: qty,
      qty_after: qty,
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
