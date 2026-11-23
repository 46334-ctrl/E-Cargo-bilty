const { Sequelize } = require('sequelize');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const mysqlUrl = process.env.MYSQL_URL || process.env.DATABASE_URL;
const host = process.env.DB_HOST || process.env.MYSQLHOST;
const user = process.env.DB_USER || process.env.MYSQLUSER;
const pass = process.env.DB_PASS || process.env.MYSQLPASSWORD || process.env.MYSQL_ROOT_PASSWORD || '';
const name = process.env.DB_NAME || process.env.MYSQLDATABASE || 'ecargobilty';
const port = process.env.DB_PORT || process.env.MYSQLPORT || 3306;

const dialect = process.env.DB_DIALECT || (mysqlUrl || host || process.env.DB_PASS ? 'mysql' : 'sqlite');

let sequelize;

if (mysqlUrl) {
  sequelize = new Sequelize(mysqlUrl, {
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else if (dialect === 'sqlite') {
  sequelize = new Sequelize({
    dialect: 'sqlite',
    storage: path.join(__dirname, 'database.sqlite'),
    logging: false
  });
} else {
  sequelize = new Sequelize(name, user, pass, {
    host: host || 'localhost',
    port: Number(port) || 3306,
    dialect: 'mysql',
    logging: false,
    pool: {
      max: 10,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  });
}

module.exports = sequelize;

