import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findZoneApex } from '../../src/utils/dns';
import type { DnsResponse } from '../../src/types/dns';

// Mock the dns-client module
vi.mock('../../src/utils/dns-client', () => ({
  queryDns: vi.fn()
}));

// Mock the rate-limiter module
vi.mock('../../src/utils/rate-limiter', () => ({
  dnsRateLimiter: {
    canMakeQuery: () => true,
    recordQuery: () => {},
    getResetTime: () => 0
  },
  RateLimitError: class RateLimitError extends Error {
    constructor(message: string, public resetTimeMs: number) {
      super(message);
    }
  }
}));

// Mock publicSuffix module
vi.mock('../../src/utils/publicSuffix', () => ({
  getPublicSuffixList: () => new Set(['co.uk', 'com.au', 'org.uk'])
}));

import { queryDns } from '../../src/utils/dns-client';
const mockQueryDns = queryDns as ReturnType<typeof vi.fn>;

describe('findZoneApex', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return the domain zone apex, not root', async () => {
    mockQueryDns.mockImplementation((domain: string, type: string) => {
      const key = `${domain}:${type}`;
      const responses: Record<string, DnsResponse> = {
        // Root zone
        '.:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: '.', type: 6 }],
          Authority: [{
            name: '.',
            type: 6,
            TTL: 86400,
            data: 'a.root-servers.net. nstld.verisign-grs.com. 2023010101 1800 900 604800 86400'
          }]
        },
        '.:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: '.', type: 2 }],
          Answer: [{ name: '.', type: 2, TTL: 86400, data: 'a.root-servers.net.' }]
        },
        // TLD zone
        'com:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'com', type: 6 }],
          Authority: [{
            name: 'com.',
            type: 6,
            TTL: 900,
            data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1234567890 1800 900 604800 86400'
          }]
        },
        'com:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'com', type: 2 }],
          Answer: [{ name: 'com.', type: 2, TTL: 172800, data: 'a.gtld-servers.net.' }]
        },
        // Domain zone (THIS is what we want!)
        'example.com:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.com', type: 6 }],
          Answer: [{
            name: 'example.com.',
            type: 6,
            TTL: 3600,
            data: 'ns1.example.com. admin.example.com. 2023010101 3600 1800 1209600 300'
          }]
        },
        'example.com:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.com', type: 2 }],
          Answer: [
            { name: 'example.com.', type: 2, TTL: 3600, data: 'ns1.example.com.' },
            { name: 'example.com.', type: 2, TTL: 3600, data: 'ns2.example.com.' }
          ]
        },
        'example.com:CNAME': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.com', type: 5 }],
          Answer: []
        }
      };

      const response = responses[key];
      if (!response) {
        throw new Error(`No mock response for ${key}`);
      }
      return Promise.resolve(response);
    });

    const zoneApex = await findZoneApex('example.com');
    
    // CRITICAL: Should return "example.com", NOT "." (root)
    expect(zoneApex).toBe('example.com');
  });

  it('should find zone apex for a subdomain (www.example.com → example.com)', async () => {
    mockQueryDns.mockImplementation((domain: string, type: string) => {
      const key = `${domain}:${type}`;
      const responses: Record<string, DnsResponse> = {
        // Root
        '.:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: '.', type: 6 }],
          Authority: [{
            name: '.',
            type: 6,
            TTL: 86400,
            data: 'a.root-servers.net. nstld.verisign-grs.com. 2023010101 1800 900 604800 86400'
          }]
        },
        '.:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: '.', type: 2 }],
          Answer: [{ name: '.', type: 2, TTL: 86400, data: 'a.root-servers.net.' }]
        },
        // TLD
        'com:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'com', type: 6 }],
          Authority: [{
            name: 'com.',
            type: 6,
            TTL: 900,
            data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1234567890 1800 900 604800 86400'
          }]
        },
        'com:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'com', type: 2 }],
          Answer: [{ name: 'com.', type: 2, TTL: 172800, data: 'a.gtld-servers.net.' }]
        },
        // Domain (zone apex)
        'example.com:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.com', type: 6 }],
          Answer: [{
            name: 'example.com.',
            type: 6,
            TTL: 3600,
            data: 'ns1.example.com. admin.example.com. 2023010101 3600 1800 1209600 300'
          }]
        },
        'example.com:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.com', type: 2 }],
          Answer: [
            { name: 'example.com.', type: 2, TTL: 3600, data: 'ns1.example.com.' },
            { name: 'example.com.', type: 2, TTL: 3600, data: 'ns2.example.com.' }
          ]
        },
        'example.com:CNAME': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.com', type: 5 }],
          Answer: []
        },
        // Subdomain (CNAME, belongs to parent zone)
        'www.example.com:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'www.example.com', type: 6 }],
          Authority: [{
            name: 'example.com.',
            type: 6,
            TTL: 3600,
            data: 'ns1.example.com. admin.example.com. 2023010101 3600 1800 1209600 300'
          }]
        },
        'www.example.com:CNAME': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'www.example.com', type: 5 }],
          Answer: [{
            name: 'www.example.com.',
            type: 5,
            TTL: 300,
            data: 'example.com.'
          }]
        }
      };

      const response = responses[key];
      if (!response) {
        throw new Error(`No mock response for ${key}`);
      }
      return Promise.resolve(response);
    });

    const zoneApex = await findZoneApex('www.example.com');
    
    // Should return the zone apex (example.com), not the subdomain
    expect(zoneApex).toBe('example.com');
  });

  it('should handle multi-label TLDs correctly (example.co.uk)', async () => {
    mockQueryDns.mockImplementation((domain: string, type: string) => {
      const key = `${domain}:${type}`;
      const responses: Record<string, DnsResponse> = {
        '.:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: '.', type: 6 }],
          Authority: [{
            name: '.',
            type: 6,
            TTL: 86400,
            data: 'a.root-servers.net. nstld.verisign-grs.com. 2023010101 1800 900 604800 86400'
          }]
        },
        '.:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: '.', type: 2 }],
          Answer: [{ name: '.', type: 2, TTL: 86400, data: 'a.root-servers.net.' }]
        },
        'uk:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'uk', type: 6 }],
          Authority: [{
            name: 'uk.',
            type: 6,
            TTL: 3600,
            data: 'ns1.nic.uk. hostmaster.nic.uk. 2023010101 3600 1800 1209600 300'
          }]
        },
        'uk:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'uk', type: 2 }],
          Answer: [{ name: 'uk.', type: 2, TTL: 172800, data: 'ns1.nic.uk.' }]
        },
        'example.co.uk:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.co.uk', type: 6 }],
          Answer: [{
            name: 'example.co.uk.',
            type: 6,
            TTL: 3600,
            data: 'ns1.example.co.uk. admin.example.co.uk. 2023010101 3600 1800 1209600 300'
          }]
        },
        'example.co.uk:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.co.uk', type: 2 }],
          Answer: [{ name: 'example.co.uk.', type: 2, TTL: 3600, data: 'ns1.example.co.uk.' }]
        },
        'example.co.uk:CNAME': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.co.uk', type: 5 }],
          Answer: []
        }
      };

      const response = responses[key];
      if (!response) {
        throw new Error(`No mock response for ${key}`);
      }
      return Promise.resolve(response);
    });

    const zoneApex = await findZoneApex('example.co.uk');
    
    // Should return the registered domain, not the TLD
    expect(zoneApex).toBe('example.co.uk');
  });

  it('should handle delegated subdomains correctly', async () => {
    mockQueryDns.mockImplementation((domain: string, type: string) => {
      const key = `${domain}:${type}`;
      const responses: Record<string, DnsResponse> = {
        '.:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: '.', type: 6 }],
          Authority: [{
            name: '.',
            type: 6,
            TTL: 86400,
            data: 'a.root-servers.net. nstld.verisign-grs.com. 2023010101 1800 900 604800 86400'
          }]
        },
        '.:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: '.', type: 2 }],
          Answer: [{ name: '.', type: 2, TTL: 86400, data: 'a.root-servers.net.' }]
        },
        'com:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'com', type: 6 }],
          Authority: [{
            name: 'com.',
            type: 6,
            TTL: 900,
            data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1234567890 1800 900 604800 86400'
          }]
        },
        'com:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'com', type: 2 }],
          Answer: [{ name: 'com.', type: 2, TTL: 172800, data: 'a.gtld-servers.net.' }]
        },
        'example.com:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.com', type: 6 }],
          Answer: [{
            name: 'example.com.',
            type: 6,
            TTL: 3600,
            data: 'ns1.example.com. admin.example.com. 2023010101 3600 1800 1209600 300'
          }]
        },
        'example.com:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.com', type: 2 }],
          Answer: [
            { name: 'example.com.', type: 2, TTL: 3600, data: 'ns1.example.com.' },
            { name: 'example.com.', type: 2, TTL: 3600, data: 'ns2.example.com.' }
          ]
        },
        'example.com:CNAME': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'example.com', type: 5 }],
          Answer: []
        },
        // staging.example.com is a DELEGATED zone (different nameservers)
        'staging.example.com:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'staging.example.com', type: 6 }],
          Answer: [{
            name: 'staging.example.com.',
            type: 6,
            TTL: 300,
            data: 'ns1.aws.com. admin.aws.com. 2023010101 300 60 3600 60'
          }]
        },
        'staging.example.com:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'staging.example.com', type: 2 }],
          Answer: [
            { name: 'staging.example.com.', type: 2, TTL: 300, data: 'ns1.aws.com.' },
            { name: 'staging.example.com.', type: 2, TTL: 300, data: 'ns2.aws.com.' }
          ]
        },
        'staging.example.com:CNAME': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: 'staging.example.com', type: 5 }],
          Answer: []
        }
      };

      const response = responses[key];
      if (!response) {
        throw new Error(`No mock response for ${key}`);
      }
      return Promise.resolve(response);
    });

    const zoneApex = await findZoneApex('staging.example.com');
    
    // Should return the delegated zone itself
    expect(zoneApex).toBe('staging.example.com');
  });

  it('should fallback to domain itself on error', async () => {
    mockQueryDns.mockRejectedValue(new Error('DNS query failed'));

    const zoneApex = await findZoneApex('faileddomain.com');
    
    // Should fallback to the domain itself
    expect(zoneApex).toBe('faileddomain.com');
  });

  it('should handle root zone correctly', async () => {
    mockQueryDns.mockImplementation((domain: string, type: string) => {
      const key = `${domain}:${type}`;
      const responses: Record<string, DnsResponse> = {
        '.:SOA': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: '.', type: 6 }],
          Authority: [{
            name: '.',
            type: 6,
            TTL: 86400,
            data: 'a.root-servers.net. nstld.verisign-grs.com. 2023010101 1800 900 604800 86400'
          }]
        },
        '.:NS': {
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: '.', type: 2 }],
          Answer: [{ name: '.', type: 2, TTL: 86400, data: 'a.root-servers.net.' }]
        }
      };

      const response = responses[key];
      if (!response) {
        throw new Error(`No mock response for ${key}`);
      }
      return Promise.resolve(response);
    });

    const zoneApex = await findZoneApex('.');
    
    // Root zone should return itself
    expect(zoneApex).toBe('.');
  });
});

