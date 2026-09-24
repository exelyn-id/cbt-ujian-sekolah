// ============================================================================
// Upstash Redis / Vercel KV Client with In-Memory Resilient Fallback
// ============================================================================

let redis = null;

// Check for Vercel KV or Upstash Redis environment variables
const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (redisUrl && redisToken) {
    try {
        const { Redis } = require('@upstash/redis');
        redis = new Redis({
            url: redisUrl,
            token: redisToken,
        });
        console.log('[Redis] Connected to Upstash Redis / Vercel KV');
    } catch (e) {
        console.warn('[Redis] Failed to initialize Upstash Redis, using memory store fallback:', e.message);
    }
}

// In-memory fallback cache (used if Redis env variables are not yet configured)
const memoryStore = new Map();
const memoryLists = new Map();

const kv = {
    async get(key) {
        if (redis) {
            try { return await redis.get(key); } catch (e) { console.error('Redis get error:', e); }
        }
        const val = memoryStore.get(key);
        return val ? JSON.parse(JSON.stringify(val)) : null;
    },

    async mget(...keys) {
        if (!keys || keys.length === 0) return [];
        const flatKeys = Array.isArray(keys[0]) ? keys[0] : keys;
        if (flatKeys.length === 0) return [];
        if (redis) {
            try { return (await redis.mget(...flatKeys)) || []; } catch (e) { console.error('Redis mget error:', e); }
        }
        return flatKeys.map(k => {
            const val = memoryStore.get(k);
            return val ? JSON.parse(JSON.stringify(val)) : null;
        });
    },

    async set(key, value, options = {}) {
        if (redis) {
            try { return await redis.set(key, value, options); } catch (e) { console.error('Redis set error:', e); }
        }
        memoryStore.set(key, JSON.parse(JSON.stringify(value)));
        return 'OK';
    },

    async del(key) {
        if (redis) {
            try { return await redis.del(key); } catch (e) { console.error('Redis del error:', e); }
        }
        memoryStore.delete(key);
        return 1;
    },

    async keys(pattern = '*') {
        if (redis) {
            try { return await redis.keys(pattern); } catch (e) { console.error('Redis keys error:', e); }
        }
        const reg = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
        const matched = [];
        for (const k of memoryStore.keys()) {
            if (reg.test(k)) matched.push(k);
        }
        return matched;
    },

    async rpush(key, ...values) {
        if (redis) {
            try { return await redis.rpush(key, ...values); } catch (e) { console.error('Redis rpush error:', e); }
        }
        if (!memoryLists.has(key)) memoryLists.set(key, []);
        const list = memoryLists.get(key);
        list.push(...values);
        return list.length;
    },

    async lpop(key, count = 1) {
        if (redis) {
            try { return await redis.lpop(key, count); } catch (e) { console.error('Redis lpop error:', e); }
        }
        if (!memoryLists.has(key)) return null;
        const list = memoryLists.get(key);
        if (list.length === 0) return null;
        if (count === 1) return list.shift();
        return list.splice(0, count);
    },

    async llen(key) {
        if (redis) {
            try { return await redis.llen(key); } catch (e) { console.error('Redis llen error:', e); }
        }
        return (memoryLists.get(key) || []).length;
    },

    async lrange(key, start, stop) {
        if (redis) {
            try { return await redis.lrange(key, start, stop); } catch (e) { console.error('Redis lrange error:', e); }
        }
        const list = memoryLists.get(key) || [];
        const end = stop === -1 ? list.length : stop + 1;
        return list.slice(start, end);
    }
};

module.exports = { kv, isRedisActive: Boolean(redis) };
