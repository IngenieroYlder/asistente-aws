module.exports = (sequelize, DataTypes) => {
  const Company = sequelize.define('Company', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    tax_id: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    slug: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    logo_url: DataTypes.STRING,
    icon_url: DataTypes.STRING,
    favicon_url: DataTypes.STRING,
    primary_color: {
      type: DataTypes.STRING,
      defaultValue: '#3B82F6' // Default Blue
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    subscription_end: {
      type: DataTypes.DATE,
      allowNull: true // Null means indefinite/lifetiime? Or not set.
    },
    plan_status: {
      type: DataTypes.ENUM('active', 'expired', 'trial', 'cancelled'),
      defaultValue: 'trial'
    },
    max_slots: {
      type: DataTypes.INTEGER,
      defaultValue: 1, 
    },
    // Contact Info
    phone: DataTypes.STRING,
    address: DataTypes.STRING,
    city: DataTypes.STRING,
    website: DataTypes.STRING,
    
    // Bot Configuration Context
    industry: {
        type: DataTypes.STRING,
        defaultValue: 'technology' 
    },
    timezone: {
        type: DataTypes.STRING,
        defaultValue: 'America/Bogota'
    },
    plan_id: {
      type: DataTypes.UUID,
      allowNull: true
    }
  }, {
    sequelize,
    modelName: 'Company',
    tableName: 'companies'
  });
  return Company;
};
