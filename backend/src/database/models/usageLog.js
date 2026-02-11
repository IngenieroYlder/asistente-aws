module.exports = (sequelize, DataTypes) => {
  const UsageLog = sequelize.define('UsageLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    company_id: DataTypes.UUID,
    model: DataTypes.STRING, // 'gpt-4o', 'whisper-1', etc.
    tokens_prompt: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    tokens_completion: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    cost_estimated: {
        type: DataTypes.FLOAT, // Estimated cost in USD
        defaultValue: 0.0
    },
    request_type: DataTypes.STRING, // 'chat', 'audio', 'image'
    date: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
  }, {
    sequelize,
    modelName: 'UsageLog',
    tableName: 'usage_logs'
  });
  return UsageLog;
};
