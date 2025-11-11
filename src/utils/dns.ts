import { getPublicSuffixList } from './publicSuffix';
import type { Node, Edge } from 'reactflow';
import { DEFAULT_RESOLVER } from '../config/resolvers';
import { queryDns } from './dns-client';

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
      zoneName = soaRecord.name.toLowerCase().replace(/\.$/, '');
      const cleanDomain = domain.toLowerCase().replace(/\.$/, '');
      if (zoneName !== cleanDomain) {
        throw new Error(`Domain ${domain} does not exist`);
      }
    } else {
      zoneName = domain.toLowerCase().replace(/\.$/, '');
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

export const buildZoneTree = async (queriedDomain: string, resolverEndpoint: string = DEFAULT_RESOLVER.endpoint) => {
  // Always do the SOA check - the API can handle it
  const initialCheck = await queryDns(queriedDomain, 'SOA', resolverEndpoint);
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
  const rootNS = await getNameservers('.', resolverEndpoint);
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
    
    const { nameservers: tldNameservers } = await getZoneInfo(tld, resolverEndpoint);
    
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
      // Walk through all possible zone boundaries from TLD upwards
      let currentParent = tld;
      let currentDepth = depth;
      
      // Start from the level right after TLD
      const startIndex = isSpecialTLD ? parts.length - 3 : parts.length - 2;
      
      for (let i = startIndex; i >= 0; i--) {
        const domainToCheck = parts.slice(i).join('.');
        
        try {
          const { zoneName: checkZone, nameservers: checkNS } = await getZoneInfo(domainToCheck, resolverEndpoint);
          
          // Check if this domain has different nameservers than its parent (delegation)
          const isDelegated = await isZoneDelegated(domainToCheck, currentParent, resolverEndpoint);
          
          if (isDelegated || i === startIndex) {
            // This is a new zone
            const domains = [checkZone];
            
            // Check if this is the queried domain
            if (domainToCheck === queriedDomain) {
              const cnameInfo = await getCnameInfo(queriedDomain, resolverEndpoint);
              if (cnameInfo.isCname) {
                domains.push(queriedDomain);
              }
              
              const zoneNode = {
                id: checkZone,
                data: {
                  label: checkZone,
                  zone: checkZone,
                  domains,
                  nameservers: checkNS,
                  depth: currentDepth,
                  isDelegated: isDelegated && i !== startIndex,
                  isCname: cnameInfo.isCname,
                  cnameTarget: cnameInfo.target
                },
                position: { x: baseX + (xOffset * currentDepth), y: yOffset * currentDepth },
                type: 'zoneNode'
              };
              
              nodes.push(zoneNode);
              edges.push({
                id: `e-${checkZone}-${currentParent}`,
                source: currentParent,
                target: checkZone,
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#4B5563', strokeWidth: 2 }
              });
              
              // We found the queried domain, we're done
              break;
            } else if (domainToCheck.endsWith(queriedDomain) === false && queriedDomain.endsWith(domainToCheck)) {
              // This zone contains the queried domain, continue checking deeper levels
              const zoneNode = {
                id: checkZone,
                data: {
                  label: checkZone,
                  zone: checkZone,
                  domains,
                  nameservers: checkNS,
                  depth: currentDepth,
                  isDelegated: isDelegated && i !== startIndex
                },
                position: { x: baseX + (xOffset * currentDepth), y: yOffset * currentDepth },
                type: 'zoneNode'
              };
              
              nodes.push(zoneNode);
              edges.push({
                id: `e-${checkZone}-${currentParent}`,
                source: currentParent,
                target: checkZone,
                type: 'smoothstep',
                animated: true,
                style: { stroke: '#4B5563', strokeWidth: 2 }
              });
              
              currentParent = checkZone;
              currentDepth++;
            }
          } else if (i === 0) {
            // This is the last level (queried domain) but not delegated - add to parent zone
            const parentNode = nodes.find(n => n.id === currentParent);
            if (parentNode && !parentNode.data.domains.includes(queriedDomain)) {
              const cnameInfo = await getCnameInfo(queriedDomain, resolverEndpoint);
              parentNode.data.domains.push(queriedDomain);
              if (cnameInfo.isCname) {
                parentNode.data.isCname = true;
                parentNode.data.cnameTarget = cnameInfo.target;
              }
            }
          }
        } catch (error) {
          // Domain doesn't exist as a zone, might be a subdomain
          if (i === 0) {
            // This is the queried domain but not a zone - add to parent
            const parentNode = nodes.find(n => n.id === currentParent);
            if (parentNode && !parentNode.data.domains.includes(queriedDomain)) {
              const cnameInfo = await getCnameInfo(queriedDomain, resolverEndpoint);
              parentNode.data.domains.push(queriedDomain);
              if (cnameInfo.isCname) {
                parentNode.data.isCname = true;
                parentNode.data.cnameTarget = cnameInfo.target;
              }
            }
          }
        }
      }
    }

  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to query DNS records');
  }

  return { nodes, edges };
};
