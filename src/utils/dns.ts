import { getPublicSuffixList } from './publicSuffix';
import type { Node, Edge } from 'reactflow';
import { DEFAULT_RESOLVER } from '../config/resolvers';
import { queryDns } from './dns-client';
import type { DetailedDnsRecords, DnsRecord, DnsResponse } from '../types/dns';

export interface ZoneHierarchyData {
  zoneName: string;
  domains: string[];
  nameservers: string[];
  depth: number;
  isDelegated: boolean;
  isCname: boolean;
  cnameTarget?: string;
  children: ZoneHierarchyData[];
}

const getNameservers = async (domain: string, endpoint: string = DEFAULT_RESOLVER.endpoint): Promise<string[]> => {
  const nsResponse = await queryDns(domain, 'NS', endpoint);
  if (nsResponse.Answer && nsResponse.Answer.length > 0) {
    return nsResponse.Answer.map(record => record.data.toLowerCase()).sort();
  }
  return [];
};

const getCnameInfo = async (domain: string, endpoint: string = DEFAULT_RESOLVER.endpoint): Promise<{
  isCname: boolean;
  target?: string;
}> => {
  const response = await queryDns(domain, 'CNAME', endpoint);
  if (response.Answer && response.Answer.length > 0) {
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

const getZoneInfo = async (domain: string, endpoint: string = DEFAULT_RESOLVER.endpoint): Promise<{ 
  zoneName: string; 
  nameservers: string[]; 
  exists: boolean;
}> => {
  const soaResponse = await queryDns(domain, 'SOA', endpoint);
  
  // Status 3 = NXDOMAIN (domain doesn't exist)
  // Status 2 = SERVFAIL (server failure)
  if (soaResponse.Status === 3) {
    throw new Error(`Domain ${domain} does not exist`);
  }
  
  // Google DNS sometimes returns Status 2 (SERVFAIL) for queries that Cloudflare handles
  // This can happen with TLD queries - treat as non-authoritative but valid
  if (soaResponse.Status === 2 && !soaResponse.Answer && !soaResponse.Authority) {
    throw new Error(`DNS server failure querying ${domain}`);
  }

  let zoneName: string;
  
  if (soaResponse.Answer && soaResponse.Answer.length > 0) {
    const soaRecord = soaResponse.Answer.find(record => record.type === 6);
    if (soaRecord) {
      // Found SOA in Answer - this domain IS a zone
      zoneName = soaRecord.name.toLowerCase().replace(/\.$/, '');
      const cleanDomain = domain.toLowerCase().replace(/\.$/, '');
      if (zoneName !== cleanDomain) {
        throw new Error(`Domain ${domain} does not exist`);
      }
    } else {
      // Answer exists but no SOA - might be a CNAME or other record
      // Check Authority section for the actual zone SOA
      if (soaResponse.Authority && soaResponse.Authority.length > 0) {
        const authSoaRecord = soaResponse.Authority.find(record => record.type === 6);
        if (authSoaRecord) {
          const cleanAuthZone = authSoaRecord.name.toLowerCase().replace(/\.$/, '');
          const cleanDomain = domain.toLowerCase().replace(/\.$/, '');
          // If Authority SOA is for a different zone, this domain is NOT a zone
          if (cleanAuthZone !== cleanDomain) {
            throw new Error(`Domain ${domain} is not a zone, belongs to ${cleanAuthZone}`);
          }
          zoneName = cleanAuthZone;
        } else {
          // No SOA anywhere - not a valid zone
          throw new Error(`Domain ${domain} does not have SOA record`);
        }
      } else {
        // No Authority section either - not a zone
        throw new Error(`Domain ${domain} does not have SOA record`);
      }
    }
  } 
  else if (soaResponse.Authority && soaResponse.Authority.length > 0) {
    const soaRecord = soaResponse.Authority.find(record => record.type === 6);
    if (soaRecord) {
      const cleanZoneName = soaRecord.name.toLowerCase().replace(/\.$/, '');
      const cleanDomain = domain.toLowerCase().replace(/\.$/, '');
      if (cleanZoneName !== cleanDomain) {
        throw new Error(`Domain ${domain} does not exist`);
      }
      zoneName = cleanZoneName;
    } else {
      // No SOA in Authority - might be a TLD or special zone
      // Just use the domain as-is and try to get NS records
      zoneName = domain.toLowerCase().replace(/\.$/, '');
    }
  } else {
    // No Answer or Authority - might be a TLD query that some resolvers handle differently
    // Try to proceed with NS lookup anyway
    zoneName = domain.toLowerCase().replace(/\.$/, '');
  }

  const nameservers = await getNameservers(zoneName, endpoint);
  
  return { 
    zoneName, 
    nameservers, 
    exists: true
  };
};

const isZoneDelegated = async (domain: string, parentZone: string, endpoint: string = DEFAULT_RESOLVER.endpoint): Promise<boolean> => {
  const parentNS = await getNameservers(parentZone, endpoint);
  const domainNS = await getNameservers(domain, endpoint);

  return domainNS.length > 0 && 
         parentNS.length > 0 && 
         !parentNS.some(ns => domainNS.includes(ns));
};

export const buildZoneHierarchy = async (
  queriedDomain: string,
  resolverEndpoint: string = DEFAULT_RESOLVER.endpoint
): Promise<ZoneHierarchyData> => {
  
  const initialCheck = await queryDns(queriedDomain, 'SOA', resolverEndpoint);
  if (initialCheck.Status === 3) {
    throw new Error(`Domain ${queriedDomain} does not exist`);
  }

  let depth = 0;

  // Root zone
  const rootNS = await getNameservers('.', resolverEndpoint);
  const root: ZoneHierarchyData = {
    zoneName: '.',
    domains: ['.'],
    nameservers: rootNS,
    depth: depth++,
    isDelegated: false,
    isCname: false,
    children: []
  };

  // If it's just the root zone, we're done
  if (queriedDomain === '.') {
    return root;
  }

  try {
    const cleanDomain = queriedDomain.replace(/\.$/, '');
    const parts = cleanDomain.split('.');
    const tld = parts[parts.length - 1];
    const publicSuffixes = getPublicSuffixList();

    const potentialPublicSuffix = parts.slice(-2).join('.');
    const isSpecialTLD = publicSuffixes.has(potentialPublicSuffix);
    
    const { nameservers: tldNameservers } = await getZoneInfo(tld, resolverEndpoint);
    
    // Always use tld as zoneName (e.g., 'uk'), but include multi-label suffix in domains if applicable
    const tldZone: ZoneHierarchyData = {
      zoneName: tld,
      domains: isSpecialTLD ? [tld, potentialPublicSuffix] : [tld],
      nameservers: tldNameservers,
      depth: depth++,
      isDelegated: true,
      isCname: false,
      children: []
    };
    root.children.push(tldZone);

    if (parts.length > (isSpecialTLD ? 2 : 1)) {
      
      let currentParent = tldZone;
      let currentDepth = depth;
      
      const startIndex = isSpecialTLD ? parts.length - 3 : parts.length - 2;
      const domainsToCheck: string[] = [];
      for (let i = startIndex; i >= 0; i--) {
        domainsToCheck.push(parts.slice(i).join('.'));
      }
      
      for (let idx = 0; idx < domainsToCheck.length; idx++) {
        const domainToCheck = domainsToCheck[idx];
        
        try {
          const { zoneName: checkZone, nameservers: checkNS } = await getZoneInfo(domainToCheck, resolverEndpoint);
          const isDelegated = await isZoneDelegated(domainToCheck, currentParent.zoneName, resolverEndpoint);
          
          if (idx === 0 || isDelegated) {
            const isQueriedDomain = (domainToCheck === queriedDomain);
            let cnameInfo: { isCname: boolean; target?: string } = { isCname: false, target: undefined };
            if (isQueriedDomain) {
              cnameInfo = await getCnameInfo(queriedDomain, resolverEndpoint);
            }
            
            const newZone: ZoneHierarchyData = {
              zoneName: checkZone,
              domains: [checkZone],
              nameservers: checkNS,
              depth: currentDepth,
              isDelegated: idx > 0 && isDelegated,
              isCname: cnameInfo.isCname,
              cnameTarget: cnameInfo.target,
              children: []
            };
            
            currentParent.children.push(newZone);
            currentParent = newZone;
            currentDepth++;
          } else {
            // Not delegated - add to parent zone's domains
            if (!currentParent.domains.includes(domainToCheck)) {
              currentParent.domains.push(domainToCheck);
              
              if (domainToCheck === queriedDomain) {
                const cnameInfo = await getCnameInfo(queriedDomain, resolverEndpoint);
                if (cnameInfo.isCname) {
                  currentParent.isCname = true;
                  currentParent.cnameTarget = cnameInfo.target;
                }
              }
            }
          }
        } catch {
          // Domain doesn't have its own zone - add to parent
          if (!currentParent.domains.includes(domainToCheck)) {
            currentParent.domains.push(domainToCheck);
            
            if (domainToCheck === queriedDomain) {
              try {
                const cnameInfo = await getCnameInfo(queriedDomain, resolverEndpoint);
                if (cnameInfo.isCname) {
                  currentParent.isCname = true;
                  currentParent.cnameTarget = cnameInfo.target;
                }
              } catch {
                // Ignore CNAME lookup errors
              }
            }
          }
        }
      }
    }
  } catch (error) {
    if (import.meta.env.DEV) console.error('Error building zone hierarchy:', error);
  }

  return root;
};

/**
 * UI Transformation: Convert ZoneHierarchyData tree to ReactFlow nodes and edges
 */
export const zoneHierarchyToReactFlow = (
  hierarchy: ZoneHierarchyData,
  baseX: number = 400,
  xOffset: number = -100,
  yOffset: number = 120
): { nodes: Node[]; edges: Edge[] } => {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const traverse = (zone: ZoneHierarchyData, parentId?: string) => {
    // Create node for this zone
    const node: Node = {
      id: zone.zoneName,
      data: {
        label: zone.zoneName === '.' ? 'Root (.)' : zone.zoneName,
        zone: zone.zoneName,
        domains: zone.domains,
        nameservers: zone.nameservers,
        depth: zone.depth,
        isDelegated: zone.isDelegated,
        isCname: zone.isCname,
        cnameTarget: zone.cnameTarget
      },
      position: {
        x: baseX + (xOffset * zone.depth),
        y: yOffset * zone.depth
      },
      type: 'zoneNode'
    };
    nodes.push(node);

    // Create edge to parent
    if (parentId) {
      edges.push({
        id: `e-${zone.zoneName}-${parentId}`,
        source: parentId,
        target: zone.zoneName,
        type: 'smoothstep',
        animated: true,
        style: { stroke: '#4B5563', strokeWidth: 2 }
      });
    }

    // Recursively process children
    zone.children.forEach(child => traverse(child, zone.zoneName));
  };

  traverse(hierarchy);
  return { nodes, edges };
};

/**
 * Main entry point: Builds DNS zone hierarchy and converts to ReactFlow visualization
 * This function combines business logic (buildZoneHierarchy) and UI transformation (zoneHierarchyToReactFlow)
 */
export const buildZoneTree = async (
  queriedDomain: string,
  resolverEndpoint: string = DEFAULT_RESOLVER.endpoint
): Promise<{ nodes: Node[]; edges: Edge[] }> => {
  // Step 1: Build pure data hierarchy (business logic)
  const hierarchy = await buildZoneHierarchy(queriedDomain, resolverEndpoint);
  
  // Step 2: Transform to ReactFlow nodes and edges (UI layer)
  return zoneHierarchyToReactFlow(hierarchy);
};

/**
 * Parse SOA record data into structured format
 */
function parseSOA(soaData: string) {
  const parts = soaData.split(' ');
  if (parts.length >= 7) {
    return {
      mname: parts[0],
      rname: parts[1],
      serial: parseInt(parts[2]),
      refresh: parseInt(parts[3]),
      retry: parseInt(parts[4]),
      expire: parseInt(parts[5]),
      minimum: parseInt(parts[6])
    };
  }
  return undefined;
}

/**
 * Query DNS multiple times and return the response with the highest TTL
 * This helps get the original TTL value instead of remaining cache time
 */
async function queryDnsWithMaxTTL(
  domain: string,
  type: string,
  endpoint: string
): Promise<DnsResponse> {
  // Make 3 parallel queries to increase chances of getting fresh TTL
  const queries = await Promise.allSettled([
    queryDns(domain, type, endpoint),
    queryDns(domain, type, endpoint),
    queryDns(domain, type, endpoint)
  ]);

  // Get all successful responses
  const successfulResponses = queries
    .filter((result): result is PromiseFulfilledResult<DnsResponse> => result.status === 'fulfilled')
    .map(result => result.value);

  if (successfulResponses.length === 0) {
    throw new Error('All DNS queries failed');
  }

  // Find the response with the highest TTL in its Answer section
  let maxTTLResponse = successfulResponses[0];
  let maxTTL = 0;

  for (const response of successfulResponses) {
    if (response.Answer && response.Answer.length > 0) {
      const ttls = response.Answer.map(record => record.TTL);
      const highestTTL = Math.max(...ttls);
      if (highestTTL > maxTTL) {
        maxTTL = highestTTL;
        maxTTLResponse = response;
      }
    }
  }

  return maxTTLResponse;
}

/**
 * Find the zone apex for a given domain
 * Uses the same zone detection logic as buildZoneHierarchy
 */
export async function findZoneApex(
  domain: string,
  resolverEndpoint: string = DEFAULT_RESOLVER.endpoint
): Promise<string> {
  try {
    // Build the zone hierarchy to find the actual zone
    const hierarchy = await buildZoneHierarchy(domain, resolverEndpoint);
    
    // Traverse the hierarchy tree to find the deepest zone (the actual apex)
    // Start from root and go down through children
    let current: ZoneHierarchyData = hierarchy;
    while (current.children && current.children.length > 0) {
      // Go to the first (and typically only) child
      current = current.children[0];
    }
    
    // The deepest zone is the apex
    return current.zoneName;
  } catch (error) {
    // If zone detection fails, return the domain as-is
    if (import.meta.env.DEV) {
      console.error('Failed to find zone apex, using domain as-is:', error);
    }
    return domain;
  }
}

/**
 * Fetch detailed DNS records for a domain (SOA, NS, A, AAAA, CNAME, MX, TXT)
 * Makes multiple queries to get the maximum (original) TTL values
 * Automatically detects and queries the zone apex for SOA/NS records
 */
export async function getDetailedDnsRecords(
  domain: string,
  resolverEndpoint: string = DEFAULT_RESOLVER.endpoint,
  precomputedZoneApex?: string
): Promise<DetailedDnsRecords> {
  const records: DetailedDnsRecords = {};

  try {
    // Use precomputed zone apex if provided, otherwise find it
    // This avoids duplicate zone detection calls
    const zoneApex = precomputedZoneApex || await findZoneApex(domain, resolverEndpoint);
    
    // Query each record type 3 times in parallel to get the max (freshest) TTL
    // DoH resolvers return remaining cache TTL, so we query multiple times and take the highest
    // SOA and NS are queried from zone apex, others from the actual domain
    const [soaRes, nsRes, aRes, aaaaRes, cnameRes, mxRes, txtRes] = await Promise.allSettled([
      queryDnsWithMaxTTL(zoneApex, 'SOA', resolverEndpoint),
      queryDnsWithMaxTTL(zoneApex, 'NS', resolverEndpoint),
      queryDnsWithMaxTTL(domain, 'A', resolverEndpoint),
      queryDnsWithMaxTTL(domain, 'AAAA', resolverEndpoint),
      queryDnsWithMaxTTL(domain, 'CNAME', resolverEndpoint),
      queryDnsWithMaxTTL(domain, 'MX', resolverEndpoint),
      queryDnsWithMaxTTL(domain, 'TXT', resolverEndpoint)
    ]);

    // SOA (type 6)
    if (soaRes.status === 'fulfilled' && soaRes.value.Answer) {
      const soaRecord = soaRes.value.Answer.find((r: DnsRecord) => r.type === 6);
      if (soaRecord) {
        records.soa = {
          ...soaRecord,
          parsed: parseSOA(soaRecord.data)
        };
      }
    }

    // NS (type 2)
    if (nsRes.status === 'fulfilled' && nsRes.value.Answer) {
      records.ns = nsRes.value.Answer.filter((r: DnsRecord) => r.type === 2);
    }

    // A (type 1)
    if (aRes.status === 'fulfilled' && aRes.value.Answer) {
      records.a = aRes.value.Answer.filter((r: DnsRecord) => r.type === 1);
    }

    // AAAA (type 28)
    if (aaaaRes.status === 'fulfilled' && aaaaRes.value.Answer) {
      records.aaaa = aaaaRes.value.Answer.filter((r: DnsRecord) => r.type === 28);
    }

    // CNAME (type 5)
    if (cnameRes.status === 'fulfilled' && cnameRes.value.Answer) {
      records.cname = cnameRes.value.Answer.filter((r: DnsRecord) => r.type === 5);
    }

    // MX (type 15)
    if (mxRes.status === 'fulfilled' && mxRes.value.Answer) {
      records.mx = mxRes.value.Answer.filter((r: DnsRecord) => r.type === 15);
    }

    // TXT (type 16)
    if (txtRes.status === 'fulfilled' && txtRes.value.Answer) {
      records.txt = txtRes.value.Answer.filter((r: DnsRecord) => r.type === 16);
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error('Error fetching detailed DNS records:', error);
    }
  }

  return records;
}
