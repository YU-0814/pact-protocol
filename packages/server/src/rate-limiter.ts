import type { Request, Response, NextFunction, RequestHandler } from 'express';

export interface RateLimitOptions {
  /** Maximum requests per minute */
  rpm: number;
  /** Maximum burst size (defaults to rpm) */
  burst?: number;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
}

/**
 * Simple token-bucket rate limiter for PACT endpoints.
 *
 * Tracks requests per IP address using an in-memory Map.
 * Returns 429 Too Many Requests with standard RateLimit headers
 * when the limit is exceeded.
 *
 * Periodically cleans up stale entries to prevent memory leaks.
 */
export function pactRateLimit(options: RateLimitOptions): RequestHandler {
  const { rpm } = options;
  const burst = options.burst ?? rpm;

  // Token bucket per IP
  const buckets = new Map<string, TokenBucket>();

  // Refill rate: tokens per millisecond
  const refillRate = rpm / 60_000;

  // Clean up stale entries every 5 minutes
  const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
  const STALE_THRESHOLD_MS = 10 * 60 * 1000;

  let lastCleanup = Date.now();

  function cleanup(now: number): void {
    if (now - lastCleanup < CLEANUP_INTERVAL_MS) {
      return;
    }
    lastCleanup = now;

    for (const [ip, bucket] of buckets) {
      if (now - bucket.lastRefill > STALE_THRESHOLD_MS) {
        buckets.delete(ip);
      }
    }
  }

  function getOrCreateBucket(ip: string, now: number): TokenBucket {
    let bucket = buckets.get(ip);
    if (!bucket) {
      bucket = { tokens: burst, lastRefill: now };
      buckets.set(ip, bucket);
      return bucket;
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefill;
    if (elapsed > 0) {
      bucket.tokens = Math.min(burst, bucket.tokens + elapsed * refillRate);
      bucket.lastRefill = now;
    }

    return bucket;
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    cleanup(now);

    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const bucket = getOrCreateBucket(ip, now);

    // Set RateLimit headers (draft RFC standard)
    const remaining = Math.max(0, Math.floor(bucket.tokens) - 1);
    const resetSeconds = Math.ceil((burst - bucket.tokens) / (refillRate * 1000));

    res.setHeader('RateLimit-Limit', String(rpm));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, remaining)));
    res.setHeader('RateLimit-Reset', String(Math.max(0, resetSeconds)));

    if (bucket.tokens < 1) {
      const retryAfterSeconds = Math.ceil((1 - bucket.tokens) / (refillRate * 1000));

      res.setHeader('Retry-After', String(Math.max(1, retryAfterSeconds)));
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: `Rate limit of ${rpm} requests per minute exceeded`,
        retry_after: Math.max(1, retryAfterSeconds),
      });
      return;
    }

    // Consume one token
    bucket.tokens -= 1;

    next();
  };
}
