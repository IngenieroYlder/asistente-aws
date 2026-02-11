module.exports = (sequelize, DataTypes) => {
  const Summary = sequelize.define('Summary', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    summary_text: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    date_range_start: DataTypes.DATE,
    date_range_end: DataTypes.DATE,
  });
  return Summary;
};
