const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env
const envPath = path.join(__dirname, '..', '.env');
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
  if (m) process.env[m[1]] = m[2];
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Remove problematic index lines and run each statement
const sql = fs.readFileSync(path.join(__dirname, '..', 'db-spa-features.sql'), 'utf8')
  .replace(/--.*$/gm, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_access_logs_date.*?;/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_visit_sessions_date.*?;/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_visit_sessions_active.*?;/g, '');

async function run() {
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration completed successfully');
  } catch (e) {
    console.error('Error:', e.message.substring(0, 300));
  } finally {
    client.release();
    await pool.end();
  }
}
run();
