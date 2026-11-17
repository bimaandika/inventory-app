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
      StockMovement.belongsTo(models.Site, { foreignKey: 'siteId', as: 'site' });
      StockMovement.belongsTo(models.Site, { foreignKey: 'toSiteId', as: 'toSite' });
      StockMovement.belongsTo(models.User, { foreignKey: 'requesterId', as: 'requester' });
      StockMovement.belongsTo(models.User, { foreignKey: 'idUser', as: 'creator' });
      StockMovement.belongsTo(StockMovement, { foreignKey: 'parentId', as: 'parent' });
      StockMovement.hasMany(StockMovement, { foreignKey: 'parentId', as: 'children' });
      StockMovement.hasMany(models.StockMovementItem, { foreignKey: 'movementId', as: 'items' });
      StockMovement.hasMany(models.History, { foreignKey: 'idSm', as: 'histories' });
    }
  }

  StockMovement.init(
    {
      number: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      type: { type: DataTypes.ENUM(...TYPES), allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false },
      statusChangedAt: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
      siteId: { type: DataTypes.INTEGER, allowNull: false },
      toSiteId: { type: DataTypes.INTEGER, allowNull: true },
      parentId: { type: DataTypes.INTEGER, allowNull: true },
      requesterId: { type: DataTypes.INTEGER, allowNull: true },
      inventoryType: { type: DataTypes.ENUM('CONSUMABLE', 'NON_CONSUMABLE'), allowNull: true },
      reason: { type: DataTypes.STRING(30), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      idUser: { type: DataTypes.INTEGER, allowNull: false },
    },
    { sequelize, modelName: 'StockMovement', tableName: 'stock_movements', underscored: true },
  );

  StockMovement.TYPES = TYPES;
  return StockMovement;
};
