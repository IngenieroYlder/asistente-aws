module.exports = (sequelize, DataTypes) => {
  const SettingsBackup = sequelize.define('SettingsBackup', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    snapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
    }
  }, {
    tableName: 'settings_backups'
  });
  return SettingsBackup;
};
