import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 3,
  enableReadyCheck: false,
  lazyConnect: true,
  connectTimeout: 10000,
  commandTimeout: 5000,
  keepAlive: 30000,
  family: 4,
  reconnectOnError: (err: Error) => {
    const targetErrors = ['READONLY', 'ECONNRESET', 'EPIPE'];
    return targetErrors.some(target => err.message.includes(target));
  },
});

// Handle Redis connection events - MUST handle error to prevent crashes
redis.on('connect', () => {
  console.log('✅ Redis connected successfully');
});

redis.on('error', (err: any) => {
  // Handle ALL errors to prevent unhandled error events
  console.error('❌ Redis error (handled):', err.code || err.message);
  
  // Don't crash the app on Redis errors
  if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
    console.log('🔄 Redis connection will retry automatically');
  }
});

redis.on('ready', () => {
  console.log('🚀 Redis is ready to accept commands');
});

redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

redis.on('reconnecting', (ms: number) => {
  console.log(`🔄 Redis reconnecting in ${ms}ms...`);
});

redis.on('end', () => {
  console.log('🔚 Redis connection ended');
});

// Create a wrapper with fallback for when Redis is unavailable
export const safeRedis = {
  async get(key: string): Promise<string | null> {
    try {
      return await redis.get(key);
    } catch (error) {
      console.warn('Redis GET failed, returning null:', error);
      return null;
    }
  },
  
  async set(key: string, value: string): Promise<'OK' | null> {
    try {
      return await redis.set(key, value);
    } catch (error) {
      console.warn('Redis SET failed:', error);
      return null;
    }
  },
  
  async del(key: string): Promise<number> {
    try {
      return await redis.del(key);
    } catch (error) {
      console.warn('Redis DEL failed:', error);
      return 0;
    }
  },
  
  async zadd(key: string, score: number, member: string): Promise<number> {
    try {
      return await redis.zadd(key, score, member);
    } catch (error) {
      console.warn('Redis ZADD failed:', error);
      return 0;
    }
  },
  
  async zrange(key: string, start: number, stop: number): Promise<string[]> {
    try {
      return await redis.zrange(key, start, stop);
    } catch (error) {
      console.warn('Redis ZRANGE failed:', error);
      return [];
    }
  },
  
  async zrem(key: string, member: string): Promise<number> {
    try {
      return await redis.zrem(key, member);
    } catch (error) {
      console.warn('Redis ZREM failed:', error);
      return 0;
    }
  },
  
  async hset(key: string, field: string | object, value?: string): Promise<number> {
    try {
      if (typeof field === 'object') {
        return await redis.hset(key, field);
      }
      return await redis.hset(key, field, value!);
    } catch (error) {
      console.warn('Redis HSET failed:', error);
      return 0;
    }
  },
  
  async hget(key: string, field: string): Promise<string | null> {
    try {
      return await redis.hget(key, field);
    } catch (error) {
      console.warn('Redis HGET failed:', error);
      return null;
    }
  },
  
  async hgetall(key: string): Promise<Record<string, string>> {
    try {
      return await redis.hgetall(key);
    } catch (error) {
      console.warn('Redis HGETALL failed:', error);
      return {};
    }
  },
  
  async hdel(key: string, ...fields: string[]): Promise<number> {
    try {
      return await redis.hdel(key, ...fields);
    } catch (error) {
      console.warn('Redis HDEL failed:', error);
      return 0;
    }
  },
  
  async zcard(key: string): Promise<number> {
    try {
      return await redis.zcard(key);
    } catch (error) {
      console.warn('Redis ZCARD failed:', error);
      return 0;
    }
  },
  
  async zscore(key: string, member: string): Promise<string | null> {
    try {
      return await redis.zscore(key, member);
    } catch (error) {
      console.warn('Redis ZSCORE failed:', error);
      return null;
    }
  },
  
  async hmget(key: string, ...fields: string[]): Promise<(string | null)[]> {
    try {
      return await redis.hmget(key, ...fields);
    } catch (error) {
      console.warn('Redis HMGET failed:', error);
      return fields.map(() => null);
    }
  },
  
  async hmset(key: string, hash: Record<string, string | number>): Promise<'OK' | null> {
    try {
      return await redis.hmset(key, hash);
    } catch (error) {
      console.warn('Redis HMSET failed:', error);
      return null;
    }
  }
};

export default redis;
