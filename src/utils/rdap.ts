import { RdapResponse } from '../types/dns';
import { fetchWithTimeout } from './dns-client';
import { APP_CONFIG } from '../config/app';

// RDAP Bootstrap service to find the right RDAP server for a TLD
const RDAP_BOOTSTRAP_URL = 'https://data.iana.org/rdap/dns.json';

// Cache for RDAP servers by TLD to avoid repeated bootstrap lookups
const rdapServerCache: Map<string, string[]> = new Map();

/**
 * Get the TLD from a domain name
 */
function getTld(domain: string): string {
  const parts = domain.split('.');
  return parts[parts.length - 1];
}

/**
 * Find the RDAP server for a given TLD using IANA's bootstrap service
 */
async function getRdapServer(tld: string): Promise<string | null> {
  // Check cache first
  if (rdapServerCache.has(tld)) {
    const servers = rdapServerCache.get(tld)!;
    return servers[0] || null;
  }

  try {
    const response = await fetchWithTimeout(
      RDAP_BOOTSTRAP_URL,
      { method: 'GET' },
      APP_CONFIG.DNS_TIMEOUT
    );

    const data = await response.json();
    
    // RDAP bootstrap format: { "services": [[["tld1", "tld2"], ["server1", "server2"]], ...] }
    for (const service of data.services) {
      const [tlds, servers] = service;
      if (tlds.includes(tld.toLowerCase())) {
        rdapServerCache.set(tld, servers);
        return servers[0] || null;
      }
    }
    
    return null;
  } catch {
    return null;
  }
}

/**
 * Query RDAP for domain registration information
 */
export async function queryRdap(domain: string): Promise<RdapResponse> {
  try {
    const tld = getTld(domain);
    const rdapServer = await getRdapServer(tld);

    if (!rdapServer) {
      return {
        error: 'RDAP server not found for this TLD'
      };
    }

    // Clean up the RDAP server URL and query the domain
    const baseUrl = rdapServer.replace(/\/$/, '');
    const rdapUrl = `${baseUrl}/domain/${domain}`;

    const response = await fetchWithTimeout(
      rdapUrl,
      { method: 'GET' },
      APP_CONFIG.DNS_TIMEOUT
    );

    if (!response.ok) {
      return {
        error: `RDAP query failed: ${response.status}`
      };
    }

    const data = await response.json();

    // Parse RDAP response
    const registrar = data.entities?.find((e: { roles?: string[] }) => 
      e.roles?.includes('registrar')
    )?.vcardArray?.[1]?.find((v: string[]) => v[0] === 'fn')?.[3];

    const events = data.events || [];
    const registrationEvent = events.find((e: { eventAction: string }) => 
      e.eventAction === 'registration'
    );
    const expirationEvent = events.find((e: { eventAction: string }) => 
      e.eventAction === 'expiration'
    );

    return {
      domain: data.ldhName || domain,
      registrar: registrar || 'Unknown',
      registrationDate: registrationEvent?.eventDate,
      expirationDate: expirationEvent?.eventDate,
      status: data.status || [],
      nameservers: data.nameservers?.map((ns: { ldhName: string }) => ns.ldhName) || []
    };
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('RDAP query error:', error);
    }
    return {
      error: 'Failed to fetch RDAP data'
    };
  }
}

