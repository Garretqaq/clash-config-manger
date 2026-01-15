interface RateLimitResult {
  success: boolean
  remaining: number
  resetTime: number
}

interface RateLimitConfig {
  windowMs: number
  maxRequests: number
}

// In-memory rate limit storage
const cache = new Map<string, { count: number; resetTime: number }>()

export function createRateLimiter(config: RateLimitConfig) {
  return (identifier: string): RateLimitResult => {
    const now = Date.now()
    const record = cache.get(identifier)

    if (!record || now > record.resetTime) {
      // Reset or create new record
      cache.set(identifier, {
        count: 1,
        resetTime: now + config.windowMs,
      })
      return {
        success: true,
        remaining: config.maxRequests - 1,
        resetTime: now + config.windowMs,
      }
    }

    if (record.count >= config.maxRequests) {
      return {
        success: false,
        remaining: 0,
        resetTime: record.resetTime,
      }
    }

    record.count++
    cache.set(identifier, record)

    return {
      success: true,
      remaining: config.maxRequests - record.count,
      resetTime: record.resetTime,
    }
  }
}

// Public access rate limiter: 60 requests per minute
export const publicLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 60,
})

// Creation rate limiter: 10 requests per minute
export const createLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
})

// Cleanup expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of Array.from(cache.entries())) {
    if (now > value.resetTime) {
      cache.delete(key)
    }
  }
}, 60 * 1000) // Run cleanup every minute
