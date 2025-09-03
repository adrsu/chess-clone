import Redis from 'ioredis';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Redis connection with better error handling
let redis: Redis;

try {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  console.log('📡 Connecting to Redis:', redisUrl.replace(/:[^:]*@/, ':***@')); // Hide password in logs
  
  const isProduction = process.env.NODE_ENV === 'production';
  redis = new Redis(redisUrl, {
    maxRetriesPerRequest: isProduction ? 3 : 1, // More retries in production
    enableReadyCheck: false,
    lazyConnect: true,
    commandTimeout: isProduction ? 15000 : 2000, // Much longer for production
    family: 4,
    reconnectOnError: () => false,
  });
} catch (error) {
  console.error('❌ Failed to create Redis client:', error);
  // Create a mock Redis client that always fails gracefully
  redis = {} as Redis;
}

// Handle Redis connection events - MUST handle error to prevent crashes
if (redis && typeof redis.on === 'function') {
  let lastLogTime = 0;
  const LOG_THROTTLE_MS = 30000; // Only log every 30 seconds

  redis.on('connect', () => {
    const now = Date.now();
    if (now - lastLogTime > LOG_THROTTLE_MS) {
      console.log('✅ Redis connected');
      lastLogTime = now;
    }
  });

  redis.on('error', (err: any) => {
    // Handle ALL errors to prevent unhandled error events
    const now = Date.now();
    if (now - lastLogTime > LOG_THROTTLE_MS) {
      console.error('❌ Redis connection issues (handled) - app continues without Redis');
      lastLogTime = now;
    }
    // Critical: Don't crash the app
  });

  redis.on('ready', () => {
    const now = Date.now();
    if (now - lastLogTime > LOG_THROTTLE_MS) {
      console.log('🚀 Redis ready');
      lastLogTime = now;
    }
  });

  redis.on('close', () => {
    // Silent - too much noise
  });

  redis.on('reconnecting', () => {
    // Silent - too much noise  
  });

  redis.on('end', () => {
    console.log('🔚 Redis connection ended');
  });
} else {
  console.log('⚠️  Redis disabled - running in offline mode');
}

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
      // Add timeout wrapper for extra protection
      const timeoutPromise = new Promise<string[]>((_, reject) => {
        setTimeout(() => reject(new Error('Redis operation timeout')), 8000);
      });
      
      const redisPromise = redis.zrange(key, start, stop);
      return await Promise.race([redisPromise, timeoutPromise]);
    } catch (error) {
      console.warn('Redis ZRANGE failed, returning empty array:', error instanceof Error ? error.message : 'Unknown error');
      return []; // Always return empty array so matchmaking can continue
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
