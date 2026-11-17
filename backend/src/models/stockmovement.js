'use strict';
const { Model } = require('sequelize');

/**
 * Header semua jenis transaksi (lihat docs/erd.md):
 * REQUEST, RETURN, GOODS_IN, TRANSFER, LOAN, LOAN_RETURN, ADJUSTMENT, OPNAME
 */
const TYPES = ['REQUEST', 'RETURN', 'GOODS_IN', 'TRANSFER', 'LOAN', 'LOAN_RETURN', 'ADJUSTMENT', 'OPNAME'];

module.exports = (sequelize, DataTypes) => {
  class StockMovement extends Model {
    static associate(models) {
      StockMovement.belongsTo(models.Site, { foreignKey: 'site_id', as: 'site' });
      StockMovement.belongsTo(models.Site, { foreignKey: 'to_site_id', as: 'toSite' });
      StockMovement.belongsTo(models.User, { foreignKey: 'requester_id', as: 'requester' });
      StockMovement.belongsTo(models.User, { foreignKey: 'id_user', as: 'creator' });
      StockMovement.belongsTo(StockMovement, { foreignKey: 'parent_id', as: 'parent' });
      StockMovement.hasMany(StockMovement, { foreignKey: 'parent_id', as: 'children' });
      StockMovement.hasMany(models.StockMovementItem, { foreignKey: 'movement_id', as: 'items' });
      StockMovement.hasMany(models.History, { foreignKey: 'id_sm', as: 'histories' });
    }
  }

  StockMovement.init(
    {
      number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      type: { type: DataTypes.ENUM(...TYPES), allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false },
      status_changed_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      site_id: { type: DataTypes.INTEGER, allowNull: false },
      to_site_id: { type: DataTypes.INTEGER, allowNull: true },
      parent_id: { type: DataTypes.INTEGER, allowNull: true },
      requester_id: { type: DataTypes.INTEGER, allowNull: true },
      inventory_type: { type: DataTypes.ENUM('CONSUMABLE', 'NON_CONSUMABLE'), allowNull: true },
      reason: { type: DataTypes.STRING(30), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      id_user: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, modelName: 'StockMovement', tableName: 'stock_movements', underscored: true },
  );

  StockMovement.TYPES = TYPES;
  return StockMovement;
};
