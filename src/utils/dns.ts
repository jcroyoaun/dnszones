import { getPublicSuffixList } from './publicSuffix';
import type { DnsResponse } from '../types/dns';
import type { Node, Edge } from 'reactflow';

const DNS_ENDPOINT = 'https://cloudflare-dns.com/dns-query';
const FETCH_TIMEOUT = 10000; // 10 seconds

const fetchWithTimeout = async (url: string, options: RequestInit, timeout: number): Promise<Response> => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('DNS query timed out. Please try again.');
    }
    throw error;
  }
};

const queryDns = async (domain: string, type: string): Promise<DnsResponse> => {
  const url = `${DNS_ENDPOINT}?name=${domain}&type=${type}`;
  const response = await fetchWithTimeout(url, {
    headers: {
      'Accept': 'application/dns-json'
    }
  }, FETCH_TIMEOUT);
  const data = await response.json();
  
  if (import.meta.env.DEV) {
    console.log(`DNS query for ${domain} (${type}):`, data);
  }
  
  return data;
};

const getNameservers = async (domain: string): Promise<string[]> => {
  const nsResponse = await queryDns(domain, 'NS');
  if (nsResponse.Answer?.length > 0) {
    return nsResponse.Answer.map(record => record.data.toLowerCase()).sort();
  }
  return [];
};

const getCnameInfo = async (domain: string): Promise<{
  isCname: boolean;
  target?: string;
}> => {
  const response = await queryDns(domain, 'CNAME');
  if (response.Answer?.length > 0) {
    const cnameRecord = response.Answer.find(record => record.type === 5);
    if (cnameRecord) {
      return {
        isCname: true,
        target: cnameRecord.data.toLowerCase()
      };
    }
  }
  return { isCname: false };
};

const getZoneInfo = async (domain: string): Promise<{ 
  zoneName: string; 
  nameservers: string[]; 
  exists: boolean;
}> => {
  const soaResponse = await queryDns(domain, 'SOA');
  
  if (soaResponse.Status === 3) {
    throw new Error(`Domain ${domain} does not exist`);
  }

  let zoneName: string;
  
  if (soaResponse.Answer?.length > 0) {
    const soaRecord = soaResponse.Answer.find(record => record.type === 6);
    if (soaRecord) {
      zoneName = soaRecord.name.toLowerCase();
      if (zoneName !== domain.toLowerCase()) {
        throw new Error(`Domain ${domain} does not exist`);
      }
    } else {
      zoneName = domain.toLowerCase();
    }
  } 
  else if (soaResponse.Authority?.length > 0) {
    const soaRecord = soaResponse.Authority.find(record => record.type === 6);
    if (soaRecord) {
      if (soaRecord.name.toLowerCase() !== domain.toLowerCase()) {
        throw new Error(`Domain ${domain} does not exist`);
      }
      zoneName = soaRecord.name.toLowerCase();
    } else {
      throw new Error(`No SOA record found for ${domain}`);
    }
  } else {
    throw new Error(`No SOA record found for ${domain}`);
  }

  const nameservers = await getNameservers(zoneName);
  
  return { 
    zoneName, 
    nameservers, 
    exists: true
  };
};

const isZoneDelegated = async (domain: string, parentZone: string): Promise<boolean> => {
  const parentNS = await getNameservers(parentZone);
  const domainNS = await getNameservers(domain);

  return domainNS.length > 0 && 
         parentNS.length > 0 && 
         !parentNS.some(ns => domainNS.includes(ns));
};

export const buildZoneTree = async (queriedDomain: string) => {
  // Always do the SOA check - the API can handle it
  const initialCheck = await queryDns(queriedDomain, 'SOA');
  if (initialCheck.Status === 3) {
    throw new Error(`Domain ${queriedDomain} does not exist`);
  }

  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const baseX = 400;
  const xOffset = -100;
  const yOffset = 120;
  let depth = 0;

  // Root node using actual DNS query
  const rootNS = await getNameservers('.');
  nodes.push({
    id: '.',
    data: { 
      label: 'Root (.)', 
      zone: '.',
      domains: ['.'],
      nameservers: rootNS,
      depth: depth++
    },
    position: { x: baseX, y: 0 },
    type: 'zoneNode'
  });

  // If it's just the root zone, we're done
  if (queriedDomain === '.') {
    return { nodes, edges };
  }

  try {
    // Remove trailing dot before splitting, will add back as needed
    const cleanDomain = queriedDomain.replace(/\.$/, '');
    const parts = cleanDomain.split('.');
    const tld = parts[parts.length - 1];
    const publicSuffixes = getPublicSuffixList();

    
    const potentialPublicSuffix = parts.slice(-2).join('.');
    const isSpecialTLD = publicSuffixes.has(potentialPublicSuffix);
    
    const { nameservers: tldNameservers } = await getZoneInfo(tld);
    
    const tldNode = {
      id: tld,
      data: {
        label: tld,
        zone: tld,
        domains: isSpecialTLD ? [tld, potentialPublicSuffix] : [tld],
        nameservers: tldNameservers,
        depth: depth++
      },
      position: { x: baseX + (xOffset * 1), y: yOffset },
      type: 'zoneNode'
    };

    nodes.push(tldNode);
    edges.push({
      id: `e-${tld}-root`,
      source: '.',
      target: tld,
      type: 'smoothstep',
      animated: true,
      style: { stroke: '#4B5563', strokeWidth: 2 }
    });

    if (parts.length > (isSpecialTLD ? 2 : 1)) {
      const domainToCheck = isSpecialTLD 
        ? `${parts[parts.length - 3]}.${potentialPublicSuffix}`
        : parts.slice(-2).join('.');

      const { zoneName: domainZone, nameservers: domainNameservers } = await getZoneInfo(domainToCheck);

      // Check for CNAME first
      const cnameInfo = await getCnameInfo(queriedDomain);
      const domains = [domainZone];

      // If the queried domain is different from the zone we found
      if (queriedDomain !== domainZone) {
        if (cnameInfo.isCname) {
          // If it's a CNAME, always add it to the parent zone
          domains.push(queriedDomain);
        } else {
          // Only check for delegation if it's not a CNAME
          const isDelegated = await isZoneDelegated(queriedDomain, domainZone);

          if (isDelegated) {
            // Create a new node for the delegated zone
            const { nameservers: subZoneNS } = await getZoneInfo(queriedDomain);
            const delegatedNode = {
              id: queriedDomain,
              data: {
                label: queriedDomain,
                zone: queriedDomain,
                domains: [queriedDomain],
                nameservers: subZoneNS,
                depth: depth + 1,
                isDelegated: true
              },
              position: { x: baseX + (xOffset * 3), y: yOffset * 3 },
              type: 'zoneNode'
            };
            nodes.push(delegatedNode);
            edges.push({
              id: `e-${queriedDomain}-${domainZone}`,
              source: domainZone,
              target: queriedDomain,
              type: 'smoothstep',
              animated: true,
              style: { stroke: '#4B5563', strokeWidth: 2 }
            });
          } else {
            // Not delegated, just add it to the parent zone's domains
            domains.push(queriedDomain);
          }
        }
      }

      const domainNode = {
        id: domainZone,
        data: {
          label: domainZone,
          zone: domainZone,
          domains,
          nameservers: domainNameservers,
          depth: depth++,
          // Include CNAME info when relevant
          isCname: cnameInfo.isCname && domains.includes(queriedDomain),
          cnameTarget: cnameInfo.isCname && domains.includes(queriedDomain) ? cnameInfo.target : undefined
        },
        position: { x: baseX + (xOffset * 2), y: yOffset * 2 },
        type: 'zoneNode'
      };

      nodes.push(domainNode);
      edges.push({
        id: `e-${domainZone}-${tld}`,
        source: tld,
        target: domainZone,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#4B5563', strokeWidth: 2 }
      });
    }

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to query DNS records');
  }

  return { nodes, edges };
};
