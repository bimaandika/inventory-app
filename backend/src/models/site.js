'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Site extends Model {
    static associate(models) {
      Site.hasMany(models.User, { foreignKey: 'siteId', as: 'users' });
      Site.hasMany(models.Inventory, { foreignKey: 'siteId', as: 'inventories' });
    }
  }

  Site.init(
    {
      name: { type: DataTypes.STRING(100), allowNull: false },
      code: { type: DataTypes.STRING(10), allowNull: false, unique: true },
    },
    { sequelize, modelName: 'Site', tableName: 'sites', underscored: true },
  );

  return Site;
};
