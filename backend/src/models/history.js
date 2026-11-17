'use strict';
const { Model } = require('sequelize');

/** Timeline transaksi: siapa melakukan apa dan kapan. */
module.exports = (sequelize, DataTypes) => {
  class History extends Model {
    static associate(models) {
      History.belongsTo(models.StockMovement, { foreignKey: 'id_sm', as: 'movement' });
      History.belongsTo(models.User, { foreignKey: 'id_user', as: 'user' });
    }
  }

  History.init(
    {
      id_sm: { type: DataTypes.INTEGER, allowNull: false },
      action: { type: DataTypes.STRING(30), allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: true },
      remarks: { type: DataTypes.TEXT, allowNull: true },
      id_user: { type: DataTypes.INTEGER, allowNull: false },
      date: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    },
    { sequelize, modelName: 'History', tableName: 'histories', underscored: true },
  );

  return History;
};
