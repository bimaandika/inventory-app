'use strict';
const { Model } = require('sequelize');
const { hashPassword } = require('../helpers/bcrypt');

module.exports = (sequelize, DataTypes) => {
  class User extends Model {
    static associate(models) {
      User.belongsTo(models.Site, { foreignKey: 'siteId', as: 'site' });
    }

    /** Jangan pernah mengirim password ke response. */
    toJSON() {
      const values = { ...this.get() };
      delete values.password;
      return values;
    }
  }

  User.init(
    {
      username: { type: DataTypes.STRING(50), allowNull: false, unique: true },
      name: { type: DataTypes.STRING(100), allowNull: false },
      password: { type: DataTypes.STRING(255), allowNull: false },
      role: {
        type: DataTypes.ENUM('admin_pusat', 'admin', 'crew'),
        allowNull: false,
        defaultValue: 'crew',
      },
      siteId: { type: DataTypes.INTEGER, allowNull: true },
      isActive: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    },
    {
      sequelize,
      modelName: 'User',
      tableName: 'users',
      underscored: true,
      // Password otomatis di-hash saat dibuat / diubah
      hooks: {
        async beforeCreate(user) {
          user.password = await hashPassword(user.password);
        },
        async beforeUpdate(user) {
          if (user.changed('password')) user.password = await hashPassword(user.password);
        },
      },
    },
  );

  return User;
};
