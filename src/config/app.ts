// Application configuration
export const APP_CONFIG = {
  // DNS query timeout in milliseconds
  DNS_TIMEOUT: parseInt(import.meta.env.VITE_DNS_TIMEOUT || '10000'),
  
  // Rate limiting: max queries per time window
  RATE_LIMIT_MAX_QUERIES: parseInt(import.meta.env.VITE_RATE_LIMIT_MAX_QUERIES || '100'),
  RATE_LIMIT_WINDOW_MS: parseInt(import.meta.env.VITE_RATE_LIMIT_WINDOW_MS || '60000'), // 1 minute
  
  // localStorage key for resolver preference
  RESOLVER_STORAGE_KEY: 'dns-resolver-preference',
} as const;

