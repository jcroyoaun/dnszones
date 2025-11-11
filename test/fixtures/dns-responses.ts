/**
 * Mock DNS response fixtures for testing
 * Based on real DNS response patterns but with generic data
 */

export const dnsResponses = {
  // ========================================
  // ROOT ZONE
  // ========================================
  '.:NS': {
    Status: 0,
    Answer: [
      { name: '.', type: 2, TTL: 518400, data: 'a.root-servers.net.' },
      { name: '.', type: 2, TTL: 518400, data: 'b.root-servers.net.' },
      { name: '.', type: 2, TTL: 518400, data: 'c.root-servers.net.' },
    ],
  },

  // ========================================
  // TLD: .com
  // ========================================
  'com:SOA': {
    Status: 0,
    Authority: [
      {
        name: 'com',
        type: 6,
        TTL: 900,
        data: 'a.gtld-servers.net. nstld.verisign-grs.com. 1731283566 1800 900 604800 86400',
      },
    ],
  },

  'com:NS': {
    Status: 0,
    Answer: [
      { name: 'com', type: 2, TTL: 172800, data: 'a.gtld-servers.net.' },
      { name: 'com', type: 2, TTL: 172800, data: 'b.gtld-servers.net.' },
      { name: 'com', type: 2, TTL: 172800, data: 'c.gtld-servers.net.' },
      { name: 'com', type: 2, TTL: 172800, data: 'd.gtld-servers.net.' },
    ],
  },

  // ========================================
  // TLD: .uk
  // ========================================
  'uk:SOA': {
    Status: 0,
    Authority: [
      {
        name: 'uk',
        type: 6,
        TTL: 900,
        data: 'ns1.nic.uk. hostmaster.nic.uk. 2024110101 3600 600 2419200 3600',
      },
    ],
  },

  'uk:NS': {
    Status: 0,
    Answer: [
      { name: 'uk', type: 2, TTL: 172800, data: 'ns1.nic.uk.' },
      { name: 'uk', type: 2, TTL: 172800, data: 'ns2.nic.uk.' },
      { name: 'uk', type: 2, TTL: 172800, data: 'ns3.nic.uk.' },
    ],
  },

  // ========================================
  // TLD: .co.uk (multi-label public suffix)
  // ========================================
  'co.uk:SOA': {
    Status: 0,
    Authority: [
      {
        name: 'uk',
        type: 6,
        TTL: 900,
        data: 'ns1.nic.uk. hostmaster.nic.uk. 2024110101 3600 600 2419200 3600',
      },
    ],
  },

  'co.uk:NS': {
    Status: 0,
    Answer: [
      { name: 'co.uk', type: 2, TTL: 172800, data: 'dns1.nic.uk.' },
      { name: 'co.uk', type: 2, TTL: 172800, data: 'dns2.nic.uk.' },
      { name: 'co.uk', type: 2, TTL: 172800, data: 'dns3.nic.uk.' },
    ],
  },

  // ========================================
  // example.com - Basic domain with zone
  // ========================================
  'example.com:SOA': {
    Status: 0,
    Answer: [
      {
        name: 'example.com',
        type: 6,
        TTL: 60,
        data: 'ns1.example-dns.com. admin.example.com. 2024110101 7200 900 1209600 86400',
      },
    ],
  },

  'example.com:NS': {
    Status: 0,
    Answer: [
      { name: 'example.com', type: 2, TTL: 60, data: 'ns1.example-dns.com.' },
      { name: 'example.com', type: 2, TTL: 60, data: 'ns2.example-dns.com.' },
      { name: 'example.com', type: 2, TTL: 60, data: 'ns3.example-dns.com.' },
      { name: 'example.com', type: 2, TTL: 60, data: 'ns4.example-dns.com.' },
    ],
  },

  'example.com:CNAME': {
    Status: 0,
    Answer: [], // No CNAME, regular domain
  },

  // ========================================
  // staging.example.com - Delegated subdomain zone
  // ========================================
  'staging.example.com:SOA': {
    Status: 0,
    Answer: [
      {
        name: 'staging.example.com',
        type: 6,
        TTL: 60,
        data: 'ns1.staging-dns.net. admin.staging.example.com. 1 300 60 3600 60',
      },
    ],
  },

  'staging.example.com:NS': {
    Status: 0,
    Answer: [
      { name: 'staging.example.com', type: 2, TTL: 60, data: 'ns1.staging-dns.net.' },
      { name: 'staging.example.com', type: 2, TTL: 60, data: 'ns2.staging-dns.net.' },
      { name: 'staging.example.com', type: 2, TTL: 60, data: 'ns3.staging-dns.net.' },
      { name: 'staging.example.com', type: 2, TTL: 60, data: 'ns4.staging-dns.net.' },
    ],
  },

  'staging.example.com:CNAME': {
    Status: 0,
    Answer: [], // No CNAME, regular domain
  },

  // ========================================
  // app.staging.example.com - CNAME in delegated zone
  // ========================================
  'app.staging.example.com:SOA': {
    Status: 0,
    Answer: [
      {
        name: 'app.staging.example.com',
        type: 5, // CNAME, not SOA!
        TTL: 300,
        data: 'lb.staging.example.com.',
      },
    ],
    Authority: [
      {
        name: 'staging.example.com',
        type: 6,
        TTL: 60,
        data: 'ns1.staging-dns.net. admin.staging.example.com. 1 300 60 3600 60',
      },
    ],
  },

  'app.staging.example.com:NS': {
    Status: 0,
    Answer: [
      {
        name: 'app.staging.example.com',
        type: 5,
        TTL: 300,
        data: 'lb.staging.example.com.',
      },
    ],
    Authority: [
      {
        name: 'staging.example.com',
        type: 6,
        TTL: 60,
        data: 'ns1.staging-dns.net. admin.staging.example.com. 1 300 60 3600 60',
      },
    ],
  },

  'app.staging.example.com:CNAME': {
    Status: 0,
    Answer: [
      {
        name: 'app.staging.example.com',
        type: 5,
        TTL: 300,
        data: 'lb.staging.example.com.',
      },
    ],
  },

  // ========================================
  // example.co.uk - Multi-label TLD case
  // ========================================
  'example.co.uk:SOA': {
    Status: 0,
    Answer: [
      {
        name: 'example.co.uk',
        type: 6,
        TTL: 1800,
        data: 'curt.ns.cloudflare.com. dns.cloudflare.com. 2388183722 10000 2400 604800 1800',
      },
    ],
  },

  'example.co.uk:NS': {
    Status: 0,
    Answer: [
      { name: 'example.co.uk', type: 2, TTL: 1800, data: 'curt.ns.cloudflare.com.' },
      { name: 'example.co.uk', type: 2, TTL: 1800, data: 'maya.ns.cloudflare.com.' },
    ],
  },

  'example.co.uk:CNAME': {
    Status: 0,
    Answer: [], // No CNAME, regular domain
  },

  // ========================================
  // subdomain.example.co.uk - Non-existent subdomain
  // Returns NOERROR with Authority section (wildcard behavior)
  // ========================================
  'subdomain.example.co.uk:SOA': {
    Status: 0, // NOERROR but no Answer
    Answer: [],
    Authority: [
      {
        name: 'example.co.uk',
        type: 6,
        TTL: 1783,
        data: 'curt.ns.cloudflare.com. dns.cloudflare.com. 2388183722 10000 2400 604800 1800',
      },
    ],
  },

  'subdomain.example.co.uk:NS': {
    Status: 0,
    Answer: [],
    Authority: [
      {
        name: 'example.co.uk',
        type: 6,
        TTL: 1783,
        data: 'curt.ns.cloudflare.com. dns.cloudflare.com. 2388183722 10000 2400 604800 1800',
      },
    ],
  },

  // ========================================
  // abc.subdomain.example.co.uk - Deep non-existent subdomain
  // ========================================
  'abc.subdomain.example.co.uk:SOA': {
    Status: 0,
    Answer: [],
    Authority: [
      {
        name: 'example.co.uk',
        type: 6,
        TTL: 1800,
        data: 'curt.ns.cloudflare.com. dns.cloudflare.com. 2388183722 10000 2400 604800 1800',
      },
    ],
  },

  'abc.subdomain.example.co.uk:NS': {
    Status: 0,
    Answer: [],
    Authority: [
      {
        name: 'example.co.uk',
        type: 6,
        TTL: 1800,
        data: 'curt.ns.cloudflare.com. dns.cloudflare.com. 2388183722 10000 2400 604800 1800',
      },
    ],
  },

  // ========================================
  // google.com - Real-world common domain
  // ========================================
  'google.com:SOA': {
    Status: 0,
    Answer: [
      {
        name: 'google.com',
        type: 6,
        TTL: 60,
        data: 'ns1.google.com. dns-admin.google.com. 830301131 900 900 1800 60',
      },
    ],
  },

  'google.com:NS': {
    Status: 0,
    Answer: [
      { name: 'google.com', type: 2, TTL: 172800, data: 'ns1.google.com.' },
      { name: 'google.com', type: 2, TTL: 172800, data: 'ns2.google.com.' },
      { name: 'google.com', type: 2, TTL: 172800, data: 'ns3.google.com.' },
      { name: 'google.com', type: 2, TTL: 172800, data: 'ns4.google.com.' },
    ],
  },

  'google.com:CNAME': {
    Status: 0,
    Answer: [], // No CNAME, regular domain
  },

  // ========================================
  // mail.google.com - Subdomain in parent zone (not delegated)
  // ========================================
  'mail.google.com:SOA': {
    Status: 0,
    Answer: [],
    Authority: [
      {
        name: 'google.com',
        type: 6,
        TTL: 60,
        data: 'ns1.google.com. dns-admin.google.com. 830301131 900 900 1800 60',
      },
    ],
  },

  'mail.google.com:NS': {
    Status: 0,
    Answer: [],
    Authority: [
      {
        name: 'google.com',
        type: 6,
        TTL: 60,
        data: 'ns1.google.com. dns-admin.google.com. 830301131 900 900 1800 60',
      },
    ],
  },

  'mail.google.com:CNAME': {
    Status: 0,
    Answer: [], // No CNAME, just a regular A record
  },

  // ========================================
  // nonexistent.google.com - NXDOMAIN
  // ========================================
  'nonexistent.google.com:SOA': {
    Status: 3, // NXDOMAIN
    Authority: [
      {
        name: 'google.com',
        type: 6,
        TTL: 60,
        data: 'ns1.google.com. dns-admin.google.com. 830301131 900 900 1800 60',
      },
    ],
  },

  // ========================================
  // Completely non-existent domain
  // ========================================
  'thisdoesnotexist.invalid:SOA': {
    Status: 3, // NXDOMAIN
  },
};

export type DnsResponseKey = keyof typeof dnsResponses;

