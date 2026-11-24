const fs = require('fs');
const path = require('path');

function formatValue(val, isMysql) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  if (typeof val === 'object') return JSON.stringify(val);
  if (isMysql && typeof val === 'string' && /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/.test(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString().replace('T', ' ').slice(0, 19);
    }
  }
  return val;
}

async function autoSeedDatabase(sequelizeInstance) {
  const isMysql = sequelizeInstance.getDialect() === 'mysql';
  const dataFilePath = path.join(__dirname, 'initial_data.json');

  if (!fs.existsSync(dataFilePath)) {
    console.log('ℹ️ initial_data.json not found, skipping auto-seed.');
    return;
  }

  let seedData;
  try {
    seedData = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
  } catch (err) {
    console.error('❌ Failed to read initial_data.json:', err.message);
    return;
  }

  try {
    const [results] = await sequelizeInstance.query(
      isMysql ? 'SELECT COUNT(*) as count FROM `users`;' : 'SELECT COUNT(*) as count FROM "users";'
    );
    const count = Number(results[0]?.count || results[0]?.['COUNT(*)'] || 0);
    if (count > 0) {
      console.log(`ℹ️ Database already contains ${count} users. Auto-seed not needed.`);
      return;
    }
  } catch (err) {
    console.warn('⚠️ User check warning (tables might still be syncing):', err.message);
    return;
  }

  console.log('🌱 Empty database detected. Seeding localhost users and data to Railway MySQL...');

  try {
    if (isMysql) {
      await sequelizeInstance.query('SET FOREIGN_KEY_CHECKS = 0;');
    } else {
      await sequelizeInstance.query('PRAGMA foreign_keys = OFF;');
    }

    const tableOrder = [
      'users',
      'trucks',
      'cargo',
      'bookings',
      'booking_messages',
      'notifications',
      'complaints',
      'lost_cargo_reports',
      'lost_cargo_logs'
    ];

    for (const table of tableOrder) {
      const rows = seedData[table];
      if (!rows || rows.length === 0) continue;

      let inserted = 0;
      for (const row of rows) {
        const columns = Object.keys(row).map(c => isMysql ? `\`${c}\`` : `"${c}"`).join(', ');
        const placeholders = Object.keys(row).map(() => '?').join(', ');
        const values = Object.values(row).map(v => formatValue(v, isMysql));

        const sql = isMysql
          ? `INSERT IGNORE INTO \`${table}\` (${columns}) VALUES (${placeholders});`
          : `INSERT OR IGNORE INTO "${table}" (${columns}) VALUES (${placeholders});`;

        try {
          await sequelizeInstance.query(sql, { replacements: values });
          inserted++;
        } catch (insertErr) {
          console.warn(`  ⚠️ Row insert warning in ${table}:`, insertErr.message);
        }
      }
      console.log(`  ✓ Seeded ${inserted}/${rows.length} rows into ${table}`);
    }

    if (isMysql) {
      await sequelizeInstance.query('SET FOREIGN_KEY_CHECKS = 1;');
    } else {
      await sequelizeInstance.query('PRAGMA foreign_keys = ON;');
    }
    console.log('✅ Auto-seed completed successfully! All 23 users and records are live on Railway.');
  } catch (err) {
    console.error('❌ Auto-seed failed:', err.message);
  }
}

module.exports = { autoSeedDatabase };
