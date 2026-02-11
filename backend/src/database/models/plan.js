module.exports = (sequelize, DataTypes) => {
  const Plan = sequelize.define('Plan', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: DataTypes.TEXT,
    price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00
    },
    currency: {
      type: DataTypes.STRING,
      defaultValue: 'USD'
    },
    billing_cycle: {
      type: DataTypes.ENUM('monthly', 'yearly'),
      defaultValue: 'monthly'
    },
    max_slots: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    max_tokens: {
      type: DataTypes.INTEGER,
      defaultValue: 1000000 // Default 1M tokens
    },
    features: {
      type: DataTypes.JSON, // Array of strings or object
      defaultValue: []
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    sequelize,
    modelName: 'Plan',
    tableName: 'plans'
  });
  return Plan;
};
