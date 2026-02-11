module.exports = (sequelize, DataTypes) => {
  const Session = sequelize.define('Session', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    company_id: DataTypes.UUID,
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_pinned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    start_time: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    end_time: DataTypes.DATE
  });
  return Session;
};
