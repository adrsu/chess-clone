import { Pool } from 'pg';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create pool configuration for Supabase
const poolConfig: any = {
  connectionString: process.env.DATABASE_URL,
  ssl: false, // Temporarily disable SSL to fix connection issue
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
};

console.log('🔧 Using DATABASE_URL connection string for Supabase');
console.log('DATABASE_URL:', process.env.DATABASE_URL);

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
