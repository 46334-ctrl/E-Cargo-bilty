/**
 * Standalone migration script to populate Railway MySQL directly
 * Usage:
 *   node server/seedToRailway.js "mysql://root:password@host:port/railway"
 * Or if MYSQL_URL is set in environment:
 *   node server/seedToRailway.js
 */

const { Sequelize } = require('sequelize');
const { autoSeedDatabase } = require('./autoSeed');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const targetUrl = process.argv[2] || process.env.MYSQL_URL || process.env.DATABASE_URL;

(async () => {
  let targetSequelize;
  if (targetUrl) {
    console.log(`Connecting to target MySQL: ${targetUrl.replace(/:[^:@]+@/, ':****@')}`);
    targetSequelize = new Sequelize(targetUrl, {
      dialect: 'mysql',
      logging: false,
      pool: { max: 5, min: 0, acquire: 30000, idle: 10000 }
    });
  } else {
    targetSequelize = require('./db');
  }

  try {
    await targetSequelize.authenticate();
    console.log('✅ Connection to database established successfully.');
    await autoSeedDatabase(targetSequelize);
    console.log('🎉 Done! All localhost user accounts, trucks, and cargo are available on Railway.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
})();
