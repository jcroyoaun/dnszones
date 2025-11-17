// Application configuration
export const APP_CONFIG = {
  // DNS query timeout in milliseconds
  DNS_TIMEOUT: parseInt(import.meta.env.VITE_DNS_TIMEOUT || '10000'),
  
  // Rate limiting: max queries per time window (protects against malicious attacks, not normal usage)
  // Each domain search = ~40 queries, so 400 allows ~10 domain searches per 10 seconds
  RATE_LIMIT_MAX_QUERIES: parseInt(import.meta.env.VITE_RATE_LIMIT_MAX_QUERIES || '400'),
  RATE_LIMIT_WINDOW_MS: parseInt(import.meta.env.VITE_RATE_LIMIT_WINDOW_MS || '10000'), // 10 seconds
  
  // localStorage key for resolver preference
  RESOLVER_STORAGE_KEY: 'dns-resolver-preference',
} as const;

