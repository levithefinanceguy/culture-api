import { Request, Response, NextFunction } from "express";

interface WindowEntry {
  timestamps: number[];
  dailyCounts: Map<string, number>; // date string -> count
}

interface TierLimits {
  perMinute: number;
  perDay: number;
}

const TIER_LIMITS: Record<string, TierLimits> = {
  free: { perMinute: 10, perDay: 100 },
  pro: { perMinute: 100, perDay: 10000 },
  enterprise: { perMinute: 500, perDay: 100000 },
  admin: { perMinute: 500, perDay: 100000 },
};

/**
 * In-memory sliding window rate limiter.
 * Tracks requests per minute (sliding window) and per day (calendar day UTC).
 */
class RateLimiter {
  private windows: Map<string, WindowEntry> = new Map();

  /**
   * Clean up stale entries every 10 minutes to prevent memory leaks.
   */
  private cleanupInterval: ReturnType<typeof setInterval>;

  constructor() {
    this.cleanupInterval = setInterval(() => this.cleanup(), 10 * 60 * 1000);
    // Allow the process to exit even if the interval is still active
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  private getEntry(key: string): WindowEntry {
    let entry = this.windows.get(key);
    if (!entry) {
      entry = { timestamps: [], dailyCounts: new Map() };
      this.windows.set(key, entry);
    }
    return entry;
  }

  /**
   * Check rate limits and record the request if allowed.
   * Returns null if allowed, or an error object if rate-limited.
   */
  check(
    apiKey: string,
    tier: string
  ): {
    allowed: boolean;
    minuteRemaining: number;
    dailyRemaining: number;
    minuteLimit: number;
    dailyLimit: number;
    resetMinute: number;
    resetDaily: number;
  } {
    const limits = TIER_LIMITS[tier] || TIER_LIMITS.free;
    const entry = this.getEntry(apiKey);
    const now = Date.now();
    const oneMinuteAgo = now - 60_000;
    const todayStr = new Date().toISOString().split("T")[0];

    // Clean old timestamps outside the 1-minute sliding window
    entry.timestamps = entry.timestamps.filter((t) => t > oneMinuteAgo);

    // Clean daily counts older than today
    for (const dateKey of entry.dailyCounts.keys()) {
      if (dateKey !== todayStr) {
        entry.dailyCounts.delete(dateKey);
      }
    }

    const minuteCount = entry.timestamps.length;
    const dailyCount = entry.dailyCounts.get(todayStr) || 0;

    const minuteRemaining = Math.max(0, limits.perMinute - minuteCount);
    const dailyRemaining = Math.max(0, limits.perDay - dailyCount);

    // Calculate reset times
    const resetMinute =
      entry.timestamps.length > 0
        ? Math.ceil((entry.timestamps[0] + 60_000) / 1000)
        : Math.ceil((now + 60_000) / 1000);

    // Daily reset: next midnight UTC
    const tomorrow = new Date(todayStr);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const resetDaily = Math.ceil(tomorrow.getTime() / 1000);

    // Check if either limit is exceeded BEFORE recording
    if (minuteCount >= limits.perMinute || dailyCount >= limits.perDay) {
      return {
        allowed: false,
        minuteRemaining: Math.max(0, limits.perMinute - minuteCount),
        dailyRemaining: Math.max(0, limits.perDay - dailyCount),
        minuteLimit: limits.perMinute,
        dailyLimit: limits.perDay,
        resetMinute,
        resetDaily,
      };
    }

    // Record the request
    entry.timestamps.push(now);
    entry.dailyCounts.set(todayStr, dailyCount + 1);

    return {
      allowed: true,
      minuteRemaining: Math.max(0, limits.perMinute - minuteCount - 1),
      dailyRemaining: Math.max(0, limits.perDay - dailyCount - 1),
      minuteLimit: limits.perMinute,
      dailyLimit: limits.perDay,
      resetMinute,
      resetDaily,
    };
  }

  /**
   * Remove entries that have had no activity in the last 15 minutes.
   */
  private cleanup(): void {
    const cutoff = Date.now() - 15 * 60 * 1000;
    for (const [key, entry] of this.windows.entries()) {
      const lastTimestamp = entry.timestamps[entry.timestamps.length - 1];
      if (!lastTimestamp || lastTimestamp < cutoff) {
        this.windows.delete(key);
      }
    }
  }

  destroy(): void {
    clearInterval(this.cleanupInterval);
  }
}

export const rateLimiter = new RateLimiter();

/**
 * Rate limiting middleware. Must run after authentication so that
 * req.apiKeyTier and the API key are available.
 */
export function rateLimitMiddleware(req: Request, res: Response, next: NextFunction): void {
  const apiKey =
    (req.headers["x-api-key"] as string) || (req.query.api_key as string);
  const tier = (req as any).apiKeyTier || "free";

  if (!apiKey) {
    next();
    return;
  }

  const result = rateLimiter.check(apiKey, tier);

  // Always set rate limit headers
  res.setHeader("X-RateLimit-Limit", `${result.dailyLimit}`);
  res.setHeader("X-RateLimit-Remaining", `${result.dailyRemaining}`);
  res.setHeader("X-RateLimit-Reset", `${result.resetDaily}`);
  res.setHeader("X-RateLimit-Limit-Minute", `${result.minuteLimit}`);
  res.setHeader("X-RateLimit-Remaining-Minute", `${result.minuteRemaining}`);
  res.setHeader("X-RateLimit-Reset-Minute", `${result.resetMinute}`);

  if (!result.allowed) {
    const isMinuteExceeded = result.minuteRemaining === 0;
    res.status(429).json({
      error: "Rate limit exceeded.",
      limit: isMinuteExceeded ? result.minuteLimit : result.dailyLimit,
      window: isMinuteExceeded ? "per_minute" : "per_day",
      tier,
      retryAfter: isMinuteExceeded ? result.resetMinute : result.resetDaily,
    });
    return;
  }

  next();
}
