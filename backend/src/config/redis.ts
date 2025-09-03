import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxmemoryPolicy: 'allkeys-lru',
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
});

// Handle Redis connection events
redis.on('connect', () => {
  console.log('Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

redis.on('ready', () => {
  console.log('Redis is ready to accept commands');
});

redis.on('close', () => {
  console.log('Redis connection closed');
});

export default redis;
