import { Pool } from 'pg';

// Create pool configuration
const poolConfig: any = {
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

// For production, use individual connection parameters instead of connectionString to force IPv4
if (process.env.NODE_ENV === 'production') {
  poolConfig.host = 'db.obswbfdhbzldydpfyfxj.supabase.co';
  poolConfig.port = 5432;
  poolConfig.database = 'postgres';
  poolConfig.user = 'postgres';
  poolConfig.password = process.env.DB_PASSWORD || 'supabasepassword27';
  console.log('🔧 Using individual DB connection parameters for IPv4');
} else {
  poolConfig.connectionString = process.env.DATABASE_URL;
  console.log('🔧 Using DATABASE_URL connection string');
}

const pool = new Pool(poolConfig);

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
