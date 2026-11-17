'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
  class Category extends Model {
    static associate(models) {
      Category.hasMany(models.Inventory, { foreignKey: 'categoryId', as: 'inventories' });
    }
  }

  Category.init(
    {
      name: { type: DataTypes.STRING(100), allowNull: false, unique: true },
    },
    { sequelize, modelName: 'Category', tableName: 'categories', underscored: true },
  );

  return Category;
};
