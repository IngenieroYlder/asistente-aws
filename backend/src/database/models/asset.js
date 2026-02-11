module.exports = (sequelize, DataTypes) => {
  const Asset = sequelize.define('Asset', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    company_id: DataTypes.UUID,
    folder_id: DataTypes.UUID, // Optional, for future folder structure
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      // unique: true, -> Removed global unique constraint, needs composite unique with company_id
    },
    filename: DataTypes.STRING,
    mimetype: DataTypes.STRING,
    url: DataTypes.STRING, // local path or public URL
    extracted_text: DataTypes.TEXT, // Content extracted from PDF/TXT
    is_knowledge: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  });
  return Asset;
};
