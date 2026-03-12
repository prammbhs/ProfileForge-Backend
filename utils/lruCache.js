const { LRUCache } = require("lru-cache");

// L1 in-memory cache — serves most requests with zero Redis/DB calls.
// Each cache is sized for a student project (~100 users).

/** Auth sub → internalId mapping. 10 min TTL. */
const authCache = new LRUCache({ max: 500, ttl: 1000 * 60 * 10 });

/** API key hash → key data. 10 min TTL. */
const apiKeyCache = new LRUCache({ max: 2000, ttl: 1000 * 60 * 10 });

/** userId → quota data. 5 min TTL. */
const quotaCache = new LRUCache({ max: 500, ttl: 1000 * 60 * 5 });

module.exports = { authCache, apiKeyCache, quotaCache };
