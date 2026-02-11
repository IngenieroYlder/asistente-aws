module.exports = (sequelize, DataTypes) => {
  const ActiveSession = sequelize.define('ActiveSession', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    company_id: DataTypes.UUID,
    user_id: DataTypes.UUID, // References Users(id)
    token: DataTypes.TEXT, // JWT Token (or hash of it)
    device_info: DataTypes.TEXT, // User-Agent or device identifier
    last_active: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'ActiveSession',
    tableName: 'active_sessions'
  });
  return ActiveSession;
};
