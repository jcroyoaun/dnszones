import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildZoneTree } from '../../src/utils/dns';
import { dnsResponses } from '../fixtures/dns-responses';

// Mock the dns-client module
vi.mock('../../src/utils/dns-client', () => ({
  queryDns: vi.fn((domain: string, type: string) => {
    const key = `${domain}:${type}` as keyof typeof dnsResponses;
    const response = dnsResponses[key];
    
    if (!response) {
      throw new Error(`No mock response for ${key}`);
    }
    
    return Promise.resolve(response);
  }),
}));

// Mock rate limiter
vi.mock('../../src/utils/rate-limiter', () => ({
  rateLimiter: {
    checkLimit: vi.fn(),
  },
  RateLimitError: class RateLimitError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'RateLimitError';
    }
  },
}));

// Mock public suffix list
vi.mock('../../src/utils/publicSuffix', () => ({
  getPublicSuffixList: vi.fn(() => new Set(['co.uk', 'org.uk', 'ac.uk'])),
}));

describe('DNS Zone Detection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Simple Domain (example.com)', () => {
    it('should create correct zone hierarchy for example.com', async () => {
      const result = await buildZoneTree('example.com');
      
      // Should have at least: Root and example.com (may or may not include TLD)
      expect(result.nodes.length).toBeGreaterThanOrEqual(2);
      
      // Check root node
      const rootNode = result.nodes.find(n => n.id === '.');
      expect(rootNode).toBeDefined();
      expect(rootNode?.data.zone).toBe('.');
      
      // Check domain node
      const domainNode = result.nodes.find(n => n.id === 'example.com');
      expect(domainNode).toBeDefined();
      expect(domainNode?.data.zone).toBe('example.com');
      expect(domainNode?.data.nameservers).toContain('ns1.example-dns.com.');
      
      // Check we have proper edges
      expect(result.edges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Delegated Subdomain (staging.example.com)', () => {
    it('should create separate zone for delegated subdomain', async () => {
      const result = await buildZoneTree('staging.example.com');
      
      // Should have at least: Root, example.com, staging.example.com
      expect(result.nodes.length).toBeGreaterThanOrEqual(3);
      
      // Check example.com node
      const parentNode = result.nodes.find(n => n.id === 'example.com');
      expect(parentNode).toBeDefined();
      expect(parentNode?.data.nameservers).toContain('ns1.example-dns.com.');
      
      // Check staging.example.com node - should be separate zone
      const stagingNode = result.nodes.find(n => n.id === 'staging.example.com');
      expect(stagingNode).toBeDefined();
      expect(stagingNode?.data.zone).toBe('staging.example.com');
      expect(stagingNode?.data.isDelegated).toBe(true);
      
      // Verify different nameservers (delegation proof)
      expect(stagingNode?.data.nameservers).toContain('ns1.staging-dns.net.');
      expect(stagingNode?.data.nameservers).not.toContain('ns1.example-dns.com.');
      
      // Check edges - should have edge from example.com to staging.example.com
      const stagingEdge = result.edges.find(
        e => e.source === 'example.com' && e.target === 'staging.example.com'
      );
      expect(stagingEdge).toBeDefined();
    });
  });

  describe('CNAME Record (app.staging.example.com)', () => {
    it('should add CNAME to parent zone, not create separate zone', async () => {
      const result = await buildZoneTree('app.staging.example.com');
      
      // Check staging.example.com node contains the subdomain
      const stagingNode = result.nodes.find(n => n.id === 'staging.example.com');
      expect(stagingNode).toBeDefined();
      expect(stagingNode?.data.domains).toContain('app.staging.example.com');
      
      // Should have CNAME info
      expect(stagingNode?.data.isCname).toBe(true);
      expect(stagingNode?.data.cnameTarget).toBe('lb.staging.example.com.');
      
      // Should NOT have a node for app
      const appNode = result.nodes.find(n => n.id === 'app.staging.example.com');
      expect(appNode).toBeUndefined();
    });
  });

  describe('Multi-label TLD (example.co.uk)', () => {
    it('should handle multi-label public suffix correctly', async () => {
      const result = await buildZoneTree('example.co.uk');
      
      // Check uk TLD node (code currently uses last label as TLD)
      const tldNode = result.nodes.find(n => n.id === 'uk');
      expect(tldNode).toBeDefined();
      expect(tldNode?.data.zone).toBe('uk');
      
      // Check that co.uk is recognized (stored in domains)
      expect(tldNode?.data.domains).toContain('co.uk');
      
      // Check example.co.uk domain node
      const domainNode = result.nodes.find(n => n.id === 'example.co.uk');
      expect(domainNode).toBeDefined();
      expect(domainNode?.data.zone).toBe('example.co.uk');
      expect(domainNode?.data.nameservers).toContain('curt.ns.cloudflare.com.');
    });
  });

  describe('Infinite Subdomains in Same Zone', () => {
    it('should add non-existent subdomain to parent zone', async () => {
      const result = await buildZoneTree('subdomain.example.co.uk');
      
      // subdomain should be IN example.co.uk zone, not separate
      const domainNode = result.nodes.find(n => n.id === 'example.co.uk');
      expect(domainNode).toBeDefined();
      expect(domainNode?.data.domains).toContain('subdomain.example.co.uk');
      
      // Should NOT create separate node for subdomain
      const subdomainNode = result.nodes.find(n => n.id === 'subdomain.example.co.uk');
      expect(subdomainNode).toBeUndefined();
    });

    it('should handle deep non-existent subdomains', async () => {
      const result = await buildZoneTree('abc.subdomain.example.co.uk');
      
      // abc.subdomain should be IN example.co.uk zone
      const domainNode = result.nodes.find(n => n.id === 'example.co.uk');
      expect(domainNode).toBeDefined();
      expect(domainNode?.data.domains).toContain('abc.subdomain.example.co.uk');
      
      // Should NOT create nodes for intermediate levels
      expect(result.nodes.find(n => n.id === 'subdomain.example.co.uk')).toBeUndefined();
      expect(result.nodes.find(n => n.id === 'abc.subdomain.example.co.uk')).toBeUndefined();
    });
  });

  describe('Common Real-World Cases', () => {
    it('should handle mail.google.com as subdomain in parent zone', async () => {
      const result = await buildZoneTree('mail.google.com');
      
      // mail should be IN google.com zone (not delegated)
      const googleNode = result.nodes.find(n => n.id === 'google.com');
      expect(googleNode).toBeDefined();
      expect(googleNode?.data.domains).toContain('mail.google.com');
      
      // Should NOT create separate node for mail
      const mailNode = result.nodes.find(n => n.id === 'mail.google.com');
      expect(mailNode).toBeUndefined();
    });
  });

  describe('Zone Delegation Detection', () => {
    it('should detect delegation by different nameservers', async () => {
      const result = await buildZoneTree('staging.example.com');
      
      const parentNode = result.nodes.find(n => n.id === 'example.com');
      const childNode = result.nodes.find(n => n.id === 'staging.example.com');
      
      // Parent and child should have different nameservers
      const parentNS = parentNode?.data.nameservers || [];
      const childNS = childNode?.data.nameservers || [];
      
      // No nameserver should be in both lists
      const commonNS = parentNS.filter(ns => childNS.includes(ns));
      expect(commonNS).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should throw error for NXDOMAIN response', async () => {
      await expect(
        buildZoneTree('nonexistent.google.com')
      ).rejects.toThrow('does not exist');
    });

    it('should throw error for completely invalid domain', async () => {
      await expect(
        buildZoneTree('thisdoesnotexist.invalid')
      ).rejects.toThrow('does not exist');
    });
  });
});

