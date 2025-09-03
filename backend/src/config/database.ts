import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Increased timeout
  // Force IPv4 to avoid IPv6 connection issues on Render
  host: process.env.NODE_ENV === 'production' ? 'db.obswbfdhbzldydpfyfxj.supabase.co' : undefined,
  port: process.env.NODE_ENV === 'production' ? 5432 : undefined,
  database: process.env.NODE_ENV === 'production' ? 'postgres' : undefined,
  user: process.env.NODE_ENV === 'production' ? 'postgres' : undefined,
  password: process.env.NODE_ENV === 'production' ? process.env.DB_PASSWORD : undefined,
});

// Handle pool errors - don't crash the app
pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err.message);
  // Don't exit - let the app continue with error handling
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Database connection failed:', err.message);
    console.log('⚠️  App will continue but database operations may fail');
  } else {
    console.log('✅ Database connected successfully');
    if (client) {
      release();
    }
  }
});

export default pool;
