import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  keepAlive: 30000,
  family: 4,
  reconnectOnError: (err) => {
    const targetError = "READONLY";
    return err.message.includes(targetError);
  },
});

// Handle Redis connection events
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err) => {
  // Don't spam logs with connection reset errors
  if (!err.message.includes('ECONNRESET')) {
    console.error('❌ Redis connection error:', err.message);
  }
});

redis.on('ready', () => {
  console.log('🚀 Redis is ready to accept commands');
});

redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

export default redis;
