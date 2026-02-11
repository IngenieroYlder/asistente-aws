const Sequelize = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASS,
  {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    dialect: 'postgres',
    logging: false,
  }
);

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import models
db.Company = require('./company')(sequelize, Sequelize);
db.User = require('./user')(sequelize, Sequelize);
db.Contact = require('./contact')(sequelize, Sequelize);
db.Session = require('./session')(sequelize, Sequelize);
db.Message = require('./message')(sequelize, Sequelize);
db.Summary = require('./summary')(sequelize, Sequelize);
db.Asset = require('./asset')(sequelize, Sequelize);
db.Setting = require('./setting')(sequelize, Sequelize);
db.Folder = require('./folder')(sequelize, Sequelize);
db.SettingsBackup = require('./settingsBackup')(sequelize, Sequelize);
db.ActiveSession = require('./activeSession')(sequelize, Sequelize);
db.UsageLog = require('./usageLog')(sequelize, Sequelize);
db.Plan = require('./plan')(sequelize, Sequelize);

// Associations

// Company -> Users
db.Company.hasMany(db.User, { foreignKey: 'company_id' });
db.User.belongsTo(db.Company, { foreignKey: 'company_id' });

// Company -> Data
db.Company.hasMany(db.Contact, { foreignKey: 'company_id' });
db.Company.hasMany(db.Session, { foreignKey: 'company_id' });
db.Company.hasMany(db.Message, { foreignKey: 'company_id' });
db.Company.hasMany(db.Asset, { foreignKey: 'company_id' });
db.Company.hasMany(db.Setting, { foreignKey: 'company_id' });
db.Company.hasMany(db.Folder, { foreignKey: 'company_id' });
db.Company.hasMany(db.SettingsBackup, { foreignKey: 'company_id' });
db.Company.hasMany(db.ActiveSession, { foreignKey: 'company_id' });
db.Company.hasMany(db.UsageLog, { foreignKey: 'company_id' });

// Contact specifics
db.Contact.hasMany(db.Session, { foreignKey: 'contact_id' });
db.Session.belongsTo(db.Contact, { foreignKey: 'contact_id' });
db.Contact.belongsTo(db.Company, { foreignKey: 'company_id' });

db.Session.hasMany(db.Message, { foreignKey: 'session_id' });
db.Message.belongsTo(db.Session, { foreignKey: 'session_id' });
db.Session.belongsTo(db.Company, { foreignKey: 'company_id' });

db.Message.belongsTo(db.Company, { foreignKey: 'company_id' });

db.Contact.hasMany(db.Summary, { foreignKey: 'contact_id' });
db.Summary.belongsTo(db.Contact, { foreignKey: 'contact_id' });
db.Summary.belongsTo(db.Company, { foreignKey: 'company_id' });

db.Asset.belongsTo(db.Company, { foreignKey: 'company_id' });
db.Setting.belongsTo(db.Company, { foreignKey: 'company_id' });
db.Folder.belongsTo(db.Company, { foreignKey: 'company_id' });
db.SettingsBackup.belongsTo(db.Company, { foreignKey: 'company_id' });
db.ActiveSession.belongsTo(db.Company, { foreignKey: 'company_id' });
db.UsageLog.belongsTo(db.Company, { foreignKey: 'company_id' });

// Plans
db.Plan.hasMany(db.Company, { foreignKey: 'plan_id' });
db.Company.belongsTo(db.Plan, { foreignKey: 'plan_id' });

// Assets inside Folders
db.Folder.hasMany(db.Asset, { foreignKey: 'folder_id' });
db.Asset.belongsTo(db.Folder, { foreignKey: 'folder_id' });

module.exports = db;
