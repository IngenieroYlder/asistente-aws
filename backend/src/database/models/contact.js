module.exports = (sequelize, DataTypes) => {
  const Contact = sequelize.define('Contact', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    company_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    platform: {
      type: DataTypes.STRING, // 'telegram', 'instagram', 'messenger'
      allowNull: false,
    },
    platform_id: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    first_name: DataTypes.STRING,
    username: DataTypes.STRING,
    avatar_url: DataTypes.STRING,
    bio: DataTypes.TEXT,
    platform_link: DataTypes.STRING,
    last_interaction: DataTypes.DATE,
    bot_paused_until: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    indexes: [
      {
        unique: true,
        fields: ['company_id', 'platform', 'platform_id']
      }
    ]
  });
  return Contact;
};
