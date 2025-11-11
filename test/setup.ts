import { vi } from 'vitest';

// Mock import.meta.env
vi.stubGlobal('import', {
  meta: {
    env: {
      DEV: false,
      VITE_DOH_CLOUDFLARE_ENDPOINT: 'https://cloudflare-dns.com/dns-query',
      VITE_DOH_GOOGLE_ENDPOINT: 'https://dns.google/resolve',
      VITE_DNS_TIMEOUT: '10000',
      VITE_RATE_LIMIT_MAX_QUERIES: '100',
      VITE_RATE_LIMIT_WINDOW_MS: '60000',
    },
  },
});

