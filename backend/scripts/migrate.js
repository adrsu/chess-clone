const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/chess_db'
});

async function runMigrations() {
  try {
    const migrationFiles = fs.readdirSync(path.join(__dirname, '../migrations'))
      .filter(file => file.endsWith('.sql'))
      .sort();

    for (const file of migrationFiles) {
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(__dirname, '../migrations', file), 'utf8');
      await pool.query(sql);
      console.log(`Migration ${file} completed`);
    }
    
    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigrations();
