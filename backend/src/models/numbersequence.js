'use strict';
const { Model } = require('sequelize');

/** Nomor urut terakhir per awalan nomor transaksi (dipakai services/numberService.js). */
module.exports = (sequelize, DataTypes) => {
  class NumberSequence extends Model {}

  NumberSequence.init(
    {
      prefix: { type: DataTypes.STRING(50), primaryKey: true },
      lastNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'NumberSequence',
      tableName: 'number_sequences',
      underscored: true,
      timestamps: false,
    },
  );

  return NumberSequence;
};
