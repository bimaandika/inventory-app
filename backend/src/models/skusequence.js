'use strict';
const { Model } = require('sequelize');

/** Nomor urut SKU terakhir per site per jenis (dipakai services/skuService.js). */
module.exports = (sequelize, DataTypes) => {
  class SkuSequence extends Model {}

  SkuSequence.init(
    {
      site_id: { type: DataTypes.INTEGER, primaryKey: true },
      type: { type: DataTypes.ENUM('CONSUMABLE', 'NON_CONSUMABLE'), primaryKey: true },
      last_number: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    },
    {
      sequelize,
      modelName: 'SkuSequence',
      tableName: 'sku_sequences',
      underscored: true,
      timestamps: false,
    },
  );

  return SkuSequence;
};
