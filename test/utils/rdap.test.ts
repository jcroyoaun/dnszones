import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { queryRdap } from '../../src/utils/rdap';

// Mock fetchWithTimeout
vi.mock('../../src/utils/dns-client', () => ({
  fetchWithTimeout: vi.fn()
}));

vi.mock('../../src/config/app', () => ({
  APP_CONFIG: {
    DNS_TIMEOUT: 10000
  }
}));

import { fetchWithTimeout } from '../../src/utils/dns-client';
const mockFetchWithTimeout = fetchWithTimeout as ReturnType<typeof vi.fn>;

describe('RDAP (WHOIS) Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Clear the RDAP server cache between tests
    vi.resetModules();
  });

  it('should successfully query RDAP data for a .com domain', async () => {
    // Mock RDAP bootstrap response
    mockFetchWithTimeout.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          services: [
            [
              ['com'],
              ['https://rdap.verisign.com/com/v1/']
            ]
          ]
        })
      } as Response)
    );

    // Mock RDAP domain query response
    mockFetchWithTimeout.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          ldhName: 'example.com',
          status: ['active'],
          entities: [
            {
              roles: ['registrar'],
              vcardArray: [
                'vcard',
                [
                  ['fn', {}, 'text', 'Example Registrar Inc.']
                ]
              ]
            }
          ],
          events: [
            {
              eventAction: 'registration',
              eventDate: '2000-01-01T00:00:00Z'
            },
            {
              eventAction: 'expiration',
              eventDate: '2025-01-01T00:00:00Z'
            }
          ],
          nameservers: [
            { ldhName: 'ns1.example.com' },
            { ldhName: 'ns2.example.com' }
          ]
        })
      } as Response)
    );

    const result = await queryRdap('example.com');

    expect(result).toBeDefined();
    expect(result.error).toBeUndefined();
    expect(result.domain).toBe('example.com');
    expect(result.registrar).toBe('Example Registrar Inc.');
    expect(result.registrationDate).toBe('2000-01-01T00:00:00Z');
    expect(result.expirationDate).toBe('2025-01-01T00:00:00Z');
    expect(result.status).toContain('active');
    expect(result.nameservers).toHaveLength(2);
  });

  it('should return error when RDAP server is not found', async () => {
    // Mock RDAP bootstrap response with no matching TLD
    mockFetchWithTimeout.mockImplementationOnce(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          services: [
            [
              ['net', 'org'],
              ['https://rdap.example.com/']
            ]
          ]
        })
      } as Response)
    );

    const result = await queryRdap('unknown.tld');

    expect(result.error).toBe('RDAP server not found for this TLD');
  });

  // TODO: Add more RDAP tests
  // Note: RDAP has internal caching that makes unit testing complex
  // Integration tests would be more appropriate for full RDAP functionality
});

