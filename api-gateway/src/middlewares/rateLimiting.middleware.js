
const { redis } = require('../config/redis');
const { config } = require('../config');
const { TooManyRequestsError } = require('../utils/error');
const logger = require('../config/logger');

const SLIDING_WINDOW_SCRIPT = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])
local maxRequests = tonumber(ARGV[3])
local member = ARGV[4]
local windowStart = now - windowMs

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)

local requestCount = redis.call('ZCARD', key)

if requestCount >= maxRequests then
    local oldestRequest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
    local resetTime = tonumber(oldestRequest[2]) + windowMs
    local retryAfter = math.max(1, math.ceil((resetTime - now) / 1000))
    return { 0, requestCount, resetTime, retryAfter }
end

redis.call('ZADD', key, now, member)

requestCount = requestCount + 1

local oldestRequest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
local resetTime = tonumber(oldestRequest[2]) + windowMs

redis.call('PEXPIRE', key, windowMs)

return { 1, requestCount, resetTime, 0 }
`;

async function rateLimiter(key, maxRequests, windowMs) {
     const now = Date.now();

     try {
          const member = `${now}-${Math.random()}`;

          const result = await redis.eval(
               SLIDING_WINDOW_SCRIPT,
               1,
               key,
               now,
               windowMs,
               maxRequests,
               member
          );

          const [allowed, requestCount, resetTime, retryAfter] = result;

          return {
               allowed: allowed === 1,
               remaining: Math.max(0, maxRequests - requestCount),
               resetTime,
               retryAfter,
          };
     } catch (err) {
          logger.error('Rate limiter error:', err);

          return {
               allowed: true,
               remaining: maxRequests,
               resetTime: now + windowMs,
          };
     }
}

function setRateLimitHeaders(res, maxRequests, result) {
     res.setHeader('X-RateLimit-Limit', maxRequests);
     res.setHeader('X-RateLimit-Remaining', result.remaining);

     if (result.resetTime) {
          res.setHeader(
               'X-RateLimit-Reset',
               new Date(result.resetTime).toISOString()
          );
     }

     if (!result.allowed && result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter);
     }
}

function ipRateLimit(options = {}) {
     const maxRequests = options.max ?? config.RATE_LIMIT_MAX_REQUESTS;
     const windowMs = options.windowMs ?? config.RATE_LIMIT_WINDOW_MS;

     return async (req, res, next) => {
          const ip = req.ip || req.connection?.remoteAddress || 'unknown';
          const key = `ratelimit:ip:${ip}`;

          const result = await rateLimiter(key, maxRequests, windowMs);

          setRateLimitHeaders(res, maxRequests, result);

          if (!result.allowed) {
               logger.warn(`Rate limit exceeded for IP: ${ip}`);

               return next(
                    new TooManyRequestsError(
                         `Too many requests. Please try again in ${result.retryAfter} seconds`,
                         result.retryAfter
                    )
               );
          }

          return next();
     };
}

function userRateLimit(options = {}) {
     const maxRequests = options.max ?? config.RATE_LIMIT_MAX_REQUESTS * 10;
     const windowMs = options.windowMs ?? config.RATE_LIMIT_WINDOW_MS;

     return async (req, res, next) => {
          if (!req.user || !req.user.id) {
               return next();
          }

          const userId = req.user.id;
          const key = `ratelimit:user:${userId}`;

          const result = await rateLimiter(key, maxRequests, windowMs);

          setRateLimitHeaders(res, maxRequests, result);

          if (!result.allowed) {
               logger.warn(`Rate limit exceeded for user: ${userId}`);

               return next(
                    new TooManyRequestsError(
                         `Too many requests. Please try again in ${result.retryAfter} seconds`,
                         result.retryAfter
                    )
               );
          }

          return next();
     };
}

function endpointRateLimit(maxRequests, windowMs) {
     return async (req, res, next) => {
          const ip = req.ip || req.connection?.remoteAddress || 'unknown';
          const endpoint = `${req.method}:${req.path}`;
          const key = `ratelimit:endpoint:${endpoint}:${ip}`;

          const result = await rateLimiter(key, maxRequests, windowMs);

          setRateLimitHeaders(res, maxRequests, result);

          if (!result.allowed) {
               logger.warn(`Endpoint rate limit exceeded for ${endpoint} from IP: ${ip}`);

               return next(
                    new TooManyRequestsError(
                         `Too many requests to this endpoint. Please try again in ${result.retryAfter} seconds`,
                         result.retryAfter
                    )
               );
          }

          return next();
     };
}

function combinedRateLimit(ipOptions = {}, userOptions = {}) {
     const ipLimiter = ipRateLimit(ipOptions);
     const userLimiter = userRateLimit(userOptions);

     return async (req, res, next) => {
          ipLimiter(req, res, (err) => {
               if (err) {
                    return next(err);
               }

               userLimiter(req, res, next);
          });
     };
}

module.exports = {
     ipRateLimit,
     userRateLimit,
     endpointRateLimit,
     combinedRateLimit,
};
