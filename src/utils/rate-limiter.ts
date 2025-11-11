import { APP_CONFIG } from '../config/app';

interface QueryRecord {
  timestamp: number;
}

class RateLimiter {
  private queries: QueryRecord[] = [];
  private readonly maxQueries: number;
  private readonly windowMs: number;

  constructor(maxQueries: number, windowMs: number) {
    this.maxQueries = maxQueries;
    this.windowMs = windowMs;
  }

  // Check if a new query is allowed
  canMakeQuery(): boolean {
    this.cleanup();
    return this.queries.length < this.maxQueries;
  }

  // Record a new query
  recordQuery(): void {
    this.queries.push({ timestamp: Date.now() });
  }

  // Get remaining queries in current window
  getRemainingQueries(): number {
    this.cleanup();
    return Math.max(0, this.maxQueries - this.queries.length);
  }

  // Get time until rate limit resets (in ms)
  getResetTime(): number {
    if (this.queries.length === 0) return 0;
    const oldestQuery = this.queries[0];
    const resetTime = oldestQuery.timestamp + this.windowMs;
    return Math.max(0, resetTime - Date.now());
  }

  // Remove expired queries from the window
  private cleanup(): void {
    const now = Date.now();
    this.queries = this.queries.filter(
      query => now - query.timestamp < this.windowMs
    );
  }

  // Reset the rate limiter (for testing or manual reset)
  reset(): void {
    this.queries = [];
  }
}

// Export a singleton instance
export const dnsRateLimiter = new RateLimiter(
  APP_CONFIG.RATE_LIMIT_MAX_QUERIES,
  APP_CONFIG.RATE_LIMIT_WINDOW_MS
);

// Error class for rate limit exceeded
export class RateLimitError extends Error {
  constructor(
    message: string,
    public resetTimeMs: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

