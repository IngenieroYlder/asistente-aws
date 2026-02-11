require('dotenv').config();
const { sequelize, Company } = require('../src/database/models');

async function listCompanies() {
  try {
    await sequelize.authenticate();
    console.log('Connection has been established successfully.');
    const companies = await Company.findAll();
    console.log('Companies:', JSON.stringify(companies, null, 2));

    const { User, Setting } = require('../src/database/models');
    const users = await User.findAll();
    console.log('Users:', JSON.stringify(users, null, 2));

    const settings = await Setting.findAll();
    console.log('Settings:', JSON.stringify(settings, null, 2));
  } catch (error) {
    console.error('Unable to connect to the database:', error);
  } finally {
    await sequelize.close();
  }
}

listCompanies();
