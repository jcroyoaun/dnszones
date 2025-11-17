import { describe, it, expect, vi, beforeEach } from 'vitest';
import { findZoneApex, getDetailedDnsRecords } from '../../src/utils/dns';
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
  getPublicSuffixList: () => ({
    isSpecialTLD: (tld: string) => ['com', 'net', 'org', 'co.uk', 'uk'].includes(tld)
  })
}));

import { queryDns } from '../../src/utils/dns-client';
const mockQueryDns = queryDns as ReturnType<typeof vi.fn>;

describe('DNS Record Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findZoneApex', () => {
    it.skip('should find zone apex for a subdomain', async () => {
      // Mock responses for www.example.com using the same fixture data
      mockQueryDns.mockImplementation((domain: string, type: string) => {
        const key = `${domain}:${type}`;
        const responses: Record<string, DnsResponse> = {
          '.:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: '.', type: 6 }],
            Authority: [{ name: '.', type: 6, TTL: 86400, data: 'a.root-servers.net. nstld.verisign-grs.com. 2023010101 1800 900 604800 86400' }]
          },
          '.:NS': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: '.', type: 2 }],
            Answer: [
              { name: '.', type: 2, TTL: 518400, data: 'a.root-servers.net.' }
            ]
          },
          'com:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'com', type: 6 }],
            Authority: [{ name: 'com', type: 6, TTL: 900, data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1 1800 900 604800 86400' }]
          },
          'com:NS': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'com', type: 2 }],
            Answer: [
              { name: 'com', type: 2, TTL: 172800, data: 'a.gtld-servers.net.' },
              { name: 'com', type: 2, TTL: 172800, data: 'b.gtld-servers.net.' }
            ]
          },
          'example.com:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'example.com', type: 6 }],
            Answer: [{ name: 'example.com', type: 6, TTL: 3600, data: 'ns1.example-dns.com. hostmaster.example.com. 2023010101 7200 3600 1209600 3600' }]
          },
          'example.com:NS': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'example.com', type: 2 }],
            Answer: [
              { name: 'example.com', type: 2, TTL: 3600, data: 'ns1.example-dns.com.' },
              { name: 'example.com', type: 2, TTL: 3600, data: 'ns2.example-dns.com.' }
            ]
          },
          'example.com:CNAME': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'example.com', type: 5 }],
            Answer: []
          },
          'www.example.com:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'www.example.com', type: 6 }],
            Authority: [{ name: 'example.com', type: 6, TTL: 3600, data: 'ns1.example-dns.com. hostmaster.example.com. 2023010101 7200 3600 1209600 3600' }]
          },
          'www.example.com:CNAME': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'www.example.com', type: 5 }],
            Answer: []
          }
        };
        return Promise.resolve(responses[key] || { Status: 3, TC: false, RD: true, RA: true, AD: false, CD: false, Question: [] });
      });

      const zoneApex = await findZoneApex('www.example.com');
      expect(zoneApex).toBe('example.com');
    });

    it.skip('should return the domain itself if it is a zone apex', async () => {
      mockQueryDns.mockImplementation((domain: string, type: string) => {
        const key = `${domain}:${type}`;
        const responses: Record<string, DnsResponse> = {
          '.:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: '.', type: 6 }],
            Authority: [{ name: '.', type: 6, TTL: 86400, data: 'a.root-servers.net. nstld.verisign-grs.com. 2023010101 1800 900 604800 86400' }]
          },
          '.:NS': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: '.', type: 2 }],
            Answer: [
              { name: '.', type: 2, TTL: 518400, data: 'a.root-servers.net.' }
            ]
          },
          'com:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'com', type: 6 }],
            Authority: [{ name: 'com', type: 6, TTL: 900, data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1 1800 900 604800 86400' }]
          },
          'com:NS': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'com', type: 2 }],
            Answer: [
              { name: 'com', type: 2, TTL: 172800, data: 'a.gtld-servers.net.' },
              { name: 'com', type: 2, TTL: 172800, data: 'b.gtld-servers.net.' }
            ]
          },
          'example.com:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'example.com', type: 6 }],
            Answer: [{ name: 'example.com', type: 6, TTL: 3600, data: 'ns1.example-dns.com. hostmaster.example.com. 2023010101 7200 3600 1209600 3600' }]
          },
          'example.com:NS': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'example.com', type: 2 }],
            Answer: [
              { name: 'example.com', type: 2, TTL: 3600, data: 'ns1.example-dns.com.' },
              { name: 'example.com', type: 2, TTL: 3600, data: 'ns2.example-dns.com.' }
            ]
          },
          'example.com:CNAME': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'example.com', type: 5 }],
            Answer: []
          }
        };
        return Promise.resolve(responses[key] || { Status: 3, TC: false, RD: true, RA: true, AD: false, CD: false, Question: [] });
      });

      const zoneApex = await findZoneApex('example.com');
      expect(zoneApex).toBe('example.com');
    });

    it('should handle errors gracefully and return domain as-is', async () => {
      mockQueryDns.mockRejectedValue(new Error('Network error'));

      const zoneApex = await findZoneApex('test.example.com');
      expect(zoneApex).toBe('test.example.com');
    });
  });

  describe('getDetailedDnsRecords', () => {
    it.skip('should query zone apex for SOA and NS records', async () => {
      mockQueryDns.mockImplementation((domain: string, type: string) => {
        const key = `${domain}:${type}`;
        const responses: Record<string, DnsResponse> = {
          // Zone hierarchy detection - root zone
          '.:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: '.', type: 6 }],
            Authority: [{ name: '.', type: 6, TTL: 86400, data: 'a.root-servers.net. nstld.verisign-grs.com. 2023010101 1800 900 604800 86400' }]
          },
          '.:NS': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: '.', type: 2 }],
            Answer: [
              { name: '.', type: 2, TTL: 518400, data: 'a.root-servers.net.' }
            ]
          },
          // Zone hierarchy detection - com
          'com:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'com', type: 6 }],
            Authority: [{ name: 'com', type: 6, TTL: 900, data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1 1800 900 604800 86400' }]
          },
          'com:NS': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'com', type: 2 }],
            Answer: [
              { name: 'com', type: 2, TTL: 172800, data: 'a.gtld-servers.net.' },
              { name: 'com', type: 2, TTL: 172800, data: 'b.gtld-servers.net.' }
            ]
          },
          'example.com:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'example.com', type: 6 }],
            Answer: [{ name: 'example.com', type: 6, TTL: 60, data: 'ns1.example-dns.com. hostmaster.example.com. 2023010101 7200 3600 1209600 3600' }]
          },
          'example.com:NS': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'example.com', type: 2 }],
            Answer: [
              { name: 'example.com', type: 2, TTL: 3600, data: 'ns1.example-dns.com.' },
              { name: 'example.com', type: 2, TTL: 3600, data: 'ns2.example-dns.com.' }
            ]
          },
          'example.com:CNAME': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'example.com', type: 5 }],
            Answer: []
          },
          'www.example.com:SOA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'www.example.com', type: 6 }],
            Authority: [{ name: 'example.com', type: 6, TTL: 60, data: 'ns1.example-dns.com. hostmaster.example.com. 2023010101 7200 3600 1209600 3600' }]
          },
          'www.example.com:CNAME': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'www.example.com', type: 5 }],
            Answer: []
          },
          'www.example.com:A': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'www.example.com', type: 1 }],
            Answer: [{ name: 'www.example.com', type: 1, TTL: 300, data: '93.184.216.34' }]
          },
          'www.example.com:AAAA': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'www.example.com', type: 28 }],
            Answer: []
          },
          'www.example.com:MX': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'www.example.com', type: 15 }],
            Answer: []
          },
          'www.example.com:TXT': {
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: 'www.example.com', type: 16 }],
            Answer: []
          }
        };
        return Promise.resolve(responses[key] || { Status: 3, TC: false, RD: true, RA: true, AD: false, CD: false, Question: [] });
      });

      const records = await getDetailedDnsRecords('www.example.com');
      
      // Should have SOA from zone apex
      expect(records.soa).toBeDefined();
      expect(records.soa?.parsed?.mname).toBe('ns1.example-dns.com.');
      
      // Should have NS from zone apex
      expect(records.ns).toBeDefined();
      expect(records.ns?.length).toBeGreaterThan(0);
      
      // Should have A record from subdomain
      expect(records.a).toBeDefined();
      expect(records.a?.length).toBeGreaterThan(0);
    });

    it('should handle max TTL selection correctly', async () => {
      let callCount = 0;
      mockQueryDns.mockImplementation((domain: string, type: string) => {
        // Simulate different TTL values for the same record
        if (type === 'SOA') {
          callCount++;
          const ttl = callCount === 2 ? 60 : 58; // Second call has max TTL
          return Promise.resolve({
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: domain, type: 6 }],
            Answer: [{ name: domain, type: 6, TTL: ttl, data: 'ns1.example-dns.com. hostmaster.example.com. 2023010101 7200 3600 1209600 3600' }]
          });
        }
        // Return basic responses for other record types
        return Promise.resolve({
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: domain, type: type === 'NS' ? 2 : 1 }],
          Answer: []
        });
      });

      const records = await getDetailedDnsRecords('example.com');
      
      // Should select the record with TTL 60 (max)
      expect(records.soa?.TTL).toBe(60);
    });

    it('should parse SOA record correctly', async () => {
      mockQueryDns.mockImplementation((domain: string, type: string) => {
        if (type === 'SOA') {
          return Promise.resolve({
            Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
            Question: [{ name: domain, type: 6 }],
            Answer: [{ 
              name: domain, 
              type: 6, 
              TTL: 3600, 
              data: 'ns1.example-dns.com. hostmaster.example.com. 2023010101 7200 3600 1209600 86400' 
            }]
          });
        }
        return Promise.resolve({
          Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
          Question: [{ name: domain, type: 2 }],
          Answer: []
        });
      });

      const records = await getDetailedDnsRecords('example.com');
      
      expect(records.soa?.parsed).toBeDefined();
      expect(records.soa?.parsed?.mname).toBe('ns1.example-dns.com.');
      expect(records.soa?.parsed?.rname).toBe('hostmaster.example.com.');
      expect(records.soa?.parsed?.serial).toBe(2023010101);
      expect(records.soa?.parsed?.refresh).toBe(7200);
      expect(records.soa?.parsed?.retry).toBe(3600);
      expect(records.soa?.parsed?.expire).toBe(1209600);
      expect(records.soa?.parsed?.minimum).toBe(86400);
    });

    it('should handle missing records gracefully', async () => {
      mockQueryDns.mockResolvedValue({
        Status: 0, TC: false, RD: true, RA: true, AD: false, CD: false,
        Question: [],
        Answer: []
      });

      const records = await getDetailedDnsRecords('nonexistent.example.com');
      
      // Should return empty for missing records (no Answer section means no records)
      expect(records.soa).toBeUndefined();
      // Empty Answer arrays result in empty/undefined records
      expect(records.a).toBeDefined(); // Will be empty array
      expect(records.ns).toBeDefined(); // Will be empty array
    });
  });

  describe('Email Formatting', () => {
    const formatEmail = (rname: string): string => {
      const cleaned = rname.replace(/\.$/, '');
      return cleaned.replace('.', '@');
    };

    it('should convert RNAME to email format', () => {
      expect(formatEmail('hostmaster.example.com.')).toBe('hostmaster@example.com');
      expect(formatEmail('admin.example.com')).toBe('admin@example.com');
      expect(formatEmail('dns-admin.example.org.')).toBe('dns-admin@example.org');
    });

    it('should handle RNAMEs with multiple dots correctly', () => {
      // Only first dot should be replaced with @
      expect(formatEmail('hostmaster.sub.example.com.')).toBe('hostmaster@sub.example.com');
    });
  });

  describe('TTL Formatting', () => {
    const formatTTL = (seconds: number): string => {
      if (seconds < 60) return `${seconds} seconds`;
      if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
      if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
      return `${Math.floor(seconds / 86400)} days`;
    };

    it('should format seconds correctly', () => {
      expect(formatTTL(30)).toBe('30 seconds');
      expect(formatTTL(59)).toBe('59 seconds');
    });

    it('should format minutes correctly', () => {
      expect(formatTTL(60)).toBe('1 minutes');
      expect(formatTTL(300)).toBe('5 minutes');
      expect(formatTTL(3599)).toBe('59 minutes');
    });

    it('should format hours correctly', () => {
      expect(formatTTL(3600)).toBe('1 hours');
      expect(formatTTL(7200)).toBe('2 hours');
      expect(formatTTL(86399)).toBe('23 hours');
    });

    it('should format days correctly', () => {
      expect(formatTTL(86400)).toBe('1 days');
      expect(formatTTL(172800)).toBe('2 days');
      expect(formatTTL(604800)).toBe('7 days');
    });
  });
});

