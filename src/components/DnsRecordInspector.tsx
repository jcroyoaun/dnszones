import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronUp, FileText } from 'lucide-react';
import { getDetailedDnsRecords, findZoneApex } from '../utils/dns';
import { queryRdap } from '../utils/rdap';
import type { DetailedDnsRecords, RdapResponse } from '../types/dns';

interface DnsRecordInspectorProps {
  domain: string;
  onClose: () => void;
  resolverEndpoint: string;
  preloadedDnsRecords?: DetailedDnsRecords | null;
  preloadedZoneApex?: string | null;
  onScrollToBottom?: (isAtBottom: boolean) => void;
}

const DnsRecordInspector: React.FC<DnsRecordInspectorProps> = ({ 
  domain, 
  resolverEndpoint, 
  preloadedDnsRecords, 
  preloadedZoneApex,
  onScrollToBottom
}) => {
  
  // DNS records and RDAP state
  const [dnsRecords, setDnsRecords] = useState<DetailedDnsRecords | null>(null);
  const [rdapData, setRdapData] = useState<RdapResponse | null>(null);
  const [loadingDns, setLoadingDns] = useState(false);
  const [loadingRdap, setLoadingRdap] = useState(false);
  const [zoneApex, setZoneApex] = useState<string | null>(null);
  const [rdapAttemptedFor, setRdapAttemptedFor] = useState<string | null>(null);
  
  // Collapsible sections state
  const [expandedSections, setExpandedSections] = useState({
    soa: false,
    records: false,
    whois: false
  });
  
  // Ref for the scrollable content
  const scrollRef = React.useRef<HTMLDivElement>(null);
  
  // Check scroll position on mount and when content changes
  React.useEffect(() => {
    const checkScroll = () => {
      if (!scrollRef.current || !onScrollToBottom) return;
      const target = scrollRef.current;
      const hasScroll = target.scrollHeight > target.clientHeight;
      const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 10;
      
      // If content becomes scrollable (sections expanded), hide footer
      // If content fits on screen, show footer
      // If scrolled to bottom, show footer
      if (hasScroll) {
        onScrollToBottom(isAtBottom);
      } else {
        onScrollToBottom(true); // No scroll needed, show footer
      }
    };
    
    // Check immediately
    checkScroll();
    
    // Check multiple times to catch content rendering
    const timer1 = setTimeout(checkScroll, 50);
    const timer2 = setTimeout(checkScroll, 150);
    const timer3 = setTimeout(checkScroll, 300);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [dnsRecords, expandedSections, onScrollToBottom]);
  
  const toggleSection = (section: 'soa' | 'records' | 'whois') => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  // Helper function to convert seconds to human-readable format
  const formatTTL = (seconds: number): string => {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  };

  // Helper function to convert RNAME to email format
  const formatEmail = (rname: string): string => {
    // Remove trailing dot if present
    const cleaned = rname.replace(/\.$/, '');
    // Replace first dot with @
    return cleaned.replace('.', '@');
  };

  // Use preloaded data or fetch DNS records on mount
  useEffect(() => {
    // Reset RDAP state when domain changes
    setRdapData(null);
    setRdapAttemptedFor(null);
    
    // If we have preloaded data, use it immediately (no fetching!)
    if (preloadedDnsRecords && preloadedZoneApex) {
      if (import.meta.env.DEV) {
        console.log('[DnsRecordInspector] Using preloaded data, zoneApex:', preloadedZoneApex);
      }
      setDnsRecords(preloadedDnsRecords);
      setZoneApex(preloadedZoneApex);
      return;
    }
    
    // Otherwise, fetch if we don't have data yet
    if (!dnsRecords && !loadingDns) {
      setLoadingDns(true);
      // Find zone apex first, then get records (passing apex to avoid duplicate zone detection)
      findZoneApex(domain, resolverEndpoint)
        .then(apex => {
          setZoneApex(apex);
          // Pass the zone apex to avoid calling findZoneApex again inside getDetailedDnsRecords
          return getDetailedDnsRecords(domain, resolverEndpoint, apex);
        })
        .then(records => {
          setDnsRecords(records);
        })
        .catch(error => {
          if (import.meta.env.DEV) {
            console.error('Failed to fetch DNS records:', error);
          }
        })
        .finally(() => setLoadingDns(false));
    }
  }, [dnsRecords, loadingDns, domain, resolverEndpoint, preloadedDnsRecords, preloadedZoneApex]);
  
  // Fetch RDAP data when WHOIS section is expanded
  useEffect(() => {
    if (import.meta.env.DEV) {
      console.log('[DnsRecordInspector] WHOIS effect triggered:', {
        whoisExpanded: expandedSections.whois,
        hasRdapData: !!rdapData,
        rdapHasError: rdapData?.error,
        loadingRdap,
        zoneApex,
        rdapAttemptedFor
      });
    }
    // Fetch if:
    // - WHOIS section is expanded
    // - We don't have RDAP data
    // - Not currently loading
    // - We have a zone apex
    // - We haven't already attempted to fetch for this zone apex (prevent infinite loops)
    const shouldFetch = expandedSections.whois && 
                       !rdapData && 
                       !loadingRdap && 
                       zoneApex &&
                       rdapAttemptedFor !== zoneApex;
                       
    if (shouldFetch) {
      if (import.meta.env.DEV) {
        console.log('[DnsRecordInspector] Fetching RDAP for zone apex:', zoneApex);
      }
      setLoadingRdap(true);
      setRdapAttemptedFor(zoneApex); // Mark this zone apex as attempted
      // Use the cached zone apex instead of calling findZoneApex again
      queryRdap(zoneApex)
        .then(data => {
          if (import.meta.env.DEV) {
            console.log('[DnsRecordInspector] RDAP data received:', data);
          }
          setRdapData(data);
        })
        .catch(error => {
          if (import.meta.env.DEV) {
            console.error('Failed to fetch RDAP data:', error);
          }
          // Set error state so UI can show something
          setRdapData({
            error: error instanceof Error ? error.message : 'Failed to fetch RDAP data'
          });
        })
        .finally(() => {
          if (import.meta.env.DEV) {
            console.log('[DnsRecordInspector] RDAP fetch complete, setting loading to false');
          }
          setLoadingRdap(false);
        });
    }
  }, [expandedSections.whois, rdapData, loadingRdap, zoneApex, rdapAttemptedFor]);

  return (
    <div className="h-full w-full bg-gradient-to-br from-gray-950 via-purple-950/20 to-gray-950 flex flex-col overflow-hidden">
      {/* Header - Compact inline design */}
      <div className="border-b border-purple-400/30 bg-gradient-to-r from-purple-900/30 to-blue-900/30 backdrop-blur-sm px-4 md:px-8 py-3 md:py-5 landscape:py-1 flex-shrink-0">
        <div className="max-w-5xl mx-auto flex items-center gap-3 md:gap-4">
          <div className="p-2 md:p-3 landscape:p-0.5 bg-purple-500/10 rounded-lg landscape:rounded">
            <FileText className="w-6 h-6 md:w-10 md:h-10 landscape:w-4 landscape:h-4 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg md:text-3xl landscape:text-xs font-bold bg-gradient-to-r from-purple-400 to-blue-500 bg-clip-text text-transparent inline">
              Record Details
            </h2>
            <span className="text-2xl md:text-4xl landscape:text-[11px] text-purple-300 font-mono ml-3 landscape:ml-1 font-bold">{domain}</span>
          </div>
        </div>
      </div>

      {/* Content - Scrollable */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 md:px-8 landscape:px-2 py-3 md:py-8 landscape:py-2"
        onScroll={(e) => {
          if (!onScrollToBottom) return;
          const target = e.currentTarget;
          const isAtBottom = target.scrollTop + target.clientHeight >= target.scrollHeight - 10;
          onScrollToBottom(isAtBottom);
        }}
      >
        <div className="max-w-5xl mx-auto space-y-3 md:space-y-6 landscape:space-y-2">
        {/* SOA Section - Educational (BLUE/CYAN) */}
        <div className="border-2 border-blue-400/40 rounded-lg overflow-hidden bg-gradient-to-r from-blue-800/20 to-cyan-800/20">
          <button
            onClick={() => toggleSection('soa')}
            className="w-full flex items-center justify-between px-4 md:px-5 landscape:px-2 py-3 md:py-4 landscape:py-1 bg-blue-800/30 hover:bg-blue-800/40 transition-colors"
          >
            <span className="font-bold text-xl md:text-2xl landscape:text-xs text-blue-200 uppercase tracking-wide">📜 SOA Record (Start of Authority)</span>
            {expandedSections.soa ? (
              <ChevronUp className="w-5 h-5 md:w-6 md:h-6 landscape:w-3 landscape:h-3 text-blue-300" />
            ) : (
              <ChevronDown className="w-5 h-5 md:w-6 md:h-6 landscape:w-3 landscape:h-3 text-blue-300" />
            )}
          </button>
          {expandedSections.soa && (
            <div className="p-3 md:p-4 landscape:p-2 space-y-3 md:space-y-4 landscape:space-y-2 bg-gray-900/40">
              {loadingDns ? (
                <div className="text-sm text-gray-400 text-center py-3">Loading...</div>
              ) : dnsRecords?.soa?.parsed ? (
                <>
                  <div className="text-sm md:text-base text-cyan-200 bg-cyan-900/20 p-3 rounded-lg border border-cyan-500/20">
                    The <strong>SOA record</strong> is like the "birth certificate" of a DNS zone. It contains critical metadata about how this zone operates!
                  </div>

                  {/* TTL */}
                  <div className="space-y-1.5 bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="text-xs md:text-sm font-bold text-cyan-300 uppercase">⏱️ TTL (Time To Live)</div>
                      <div className="text-sm md:text-base font-mono text-white">{dnsRecords.soa.TTL}s ({formatTTL(dnsRecords.soa.TTL)})</div>
                    </div>
                    <div className="text-xs md:text-sm text-gray-300 leading-relaxed">
                      How long DNS resolvers cache this SOA record. Lower TTL = fresher data but more queries. Higher TTL = less server load but slower updates.
                    </div>
                  </div>

                  {/* Primary Nameserver */}
                  <div className="space-y-1.5 bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="text-xs md:text-sm font-bold text-cyan-300 uppercase">🖥️ Primary Nameserver (MNAME)</div>
                      <div className="text-xs md:text-sm font-mono text-white break-all">{dnsRecords.soa.parsed.mname}</div>
                    </div>
                    <div className="text-xs md:text-sm text-gray-300 leading-relaxed">
                      The "master" authoritative DNS server where the original zone file lives. All DNS changes happen here first, then propagate to secondary servers.
                    </div>
                  </div>

                  {/* Responsible Person */}
                  <div className="space-y-1.5 bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between flex-wrap gap-1">
                      <div className="text-xs md:text-sm font-bold text-cyan-300 uppercase">👤 Responsible Person (RNAME)</div>
                      <div className="text-xs md:text-sm font-mono text-white break-all">
                        {dnsRecords.soa.parsed.rname} <span className="text-gray-400">({formatEmail(dnsRecords.soa.parsed.rname)})</span>
                      </div>
                    </div>
                    <div className="text-xs md:text-sm text-gray-300 leading-relaxed">
                      Email of the zone administrator. The first dot is converted to @ for the email format. Contact them for DNS issues!
                    </div>
                  </div>

                  {/* Serial Number */}
                  <div className="space-y-1.5 bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="text-xs md:text-sm font-bold text-cyan-300 uppercase">🔢 Serial Number</div>
                      <div className="text-sm md:text-base font-mono text-white">{dnsRecords.soa.parsed.serial}</div>
                    </div>
                    <div className="text-xs md:text-sm text-gray-300 leading-relaxed">
                      Version number that increments every time the zone changes. Secondary nameservers use this to know when to pull updates. Like a Git commit number for DNS!
                    </div>
                  </div>

                  {/* Refresh */}
                  <div className="space-y-1.5 bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="text-xs md:text-sm font-bold text-cyan-300 uppercase">🔄 Refresh Interval</div>
                      <div className="text-sm md:text-base font-mono text-white">{dnsRecords.soa.parsed.refresh}s ({formatTTL(dnsRecords.soa.parsed.refresh)})</div>
                    </div>
                    <div className="text-xs md:text-sm text-gray-300 leading-relaxed">
                      How often secondary nameservers check the primary for zone updates. Like "check for new emails every X hours." More frequent = more up-to-date but more traffic.
                    </div>
                  </div>

                  {/* Retry */}
                  <div className="space-y-1.5 bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="text-xs md:text-sm font-bold text-cyan-300 uppercase">⚠️ Retry Interval</div>
                      <div className="text-sm md:text-base font-mono text-white">{dnsRecords.soa.parsed.retry}s ({formatTTL(dnsRecords.soa.parsed.retry)})</div>
                    </div>
                    <div className="text-xs md:text-sm text-gray-300 leading-relaxed">
                      If a refresh attempt fails (primary server is down or unreachable), wait this long before trying again. The "oops, let me try again" timer.
                    </div>
                  </div>

                  {/* Expire */}
                  <div className="space-y-1.5 bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="text-xs md:text-sm font-bold text-cyan-300 uppercase">💀 Expire Time</div>
                      <div className="text-sm md:text-base font-mono text-white">{dnsRecords.soa.parsed.expire}s ({formatTTL(dnsRecords.soa.parsed.expire)})</div>
                    </div>
                    <div className="text-xs md:text-sm text-gray-300 leading-relaxed">
                      If secondary servers can't reach the primary for THIS long, they stop answering queries for this zone entirely. The "I give up, this zone is dead" timer. Usually set to weeks.
                    </div>
                  </div>

                  {/* Negative Caching (Minimum TTL) */}
                  <div className="space-y-1.5 bg-gray-800/40 p-3 rounded-lg border border-gray-700/50">
                    <div className="flex items-center justify-between">
                      <div className="text-xs md:text-sm font-bold text-cyan-300 uppercase">🚫 Negative Caching TTL (Minimum)</div>
                      <div className="text-sm md:text-base font-mono text-white">{dnsRecords.soa.parsed.minimum}s ({formatTTL(dnsRecords.soa.parsed.minimum)})</div>
                    </div>
                    <div className="text-xs md:text-sm text-gray-300 leading-relaxed">
                      How long to cache "this domain doesn't exist" (NXDOMAIN) responses. 
                      If you query a non-existent subdomain, resolvers remember it doesn't exist for this duration instead of asking repeatedly. 
                      Prevents DNS servers from getting hammered with queries for non-existent domains.
                    </div>
                  </div>

                  <div className="text-sm md:text-base text-cyan-200 bg-cyan-900/20 p-3 rounded-lg border border-cyan-500/20">
                    💡 <strong>Pro Tip:</strong> Planning DNS changes? Lower your TTL a day before so updates propagate faster. After changes are stable, raise it back up to reduce query load!
                  </div>
                </>
              ) : (
                <div className="text-sm text-gray-400 text-center py-3">
                  {dnsRecords ? 'No SOA record found for this domain' : 'Failed to load SOA record'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* DNS Records Section - Educational (PURPLE/PINK) */}
        <div className="border-2 border-purple-400/40 rounded-lg overflow-hidden bg-gradient-to-r from-purple-800/20 to-pink-800/20">
          <button
            onClick={() => toggleSection('records')}
            className="w-full flex items-center justify-between px-4 md:px-5 landscape:px-2 py-3 md:py-4 landscape:py-1 bg-purple-800/30 hover:bg-purple-800/40 transition-colors"
          >
            <span className="font-bold text-xl md:text-2xl landscape:text-xs text-purple-200 uppercase tracking-wide">🗂️ DNS Records</span>
            {expandedSections.records ? (
              <ChevronUp className="w-5 h-5 md:w-6 md:h-6 landscape:w-3 landscape:h-3 text-purple-300" />
            ) : (
              <ChevronDown className="w-5 h-5 md:w-6 md:h-6 landscape:w-3 landscape:h-3 text-purple-300" />
            )}
          </button>
          {expandedSections.records && (
            <div className="p-3 md:p-4 landscape:p-2 space-y-2 md:space-y-3 landscape:space-y-1.5 bg-gray-900/40">
              {loadingDns ? (
                <div className="text-sm text-gray-400 text-center py-3">Loading...</div>
              ) : dnsRecords ? (
                <>
                  <div className="text-sm md:text-base text-cyan-200 bg-cyan-900/20 p-3 rounded-lg border border-cyan-500/20">
                    These are the actual <strong>DNS records</strong> that map domain names to IP addresses and other services. Each type serves a different purpose!
                  </div>

                  {dnsRecords.a && dnsRecords.a.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-red-300 uppercase bg-red-900/20 p-2.5 rounded border border-red-500/30">📍 A Records (IPv4 Addresses)</div>
                      <div className="text-xs md:text-sm text-gray-300 bg-gray-800/20 p-2.5 rounded mb-1.5">
                        Maps domain names to IPv4 addresses. When you visit a website, your browser uses A records to find the server's IP address.
                      </div>
                      {dnsRecords.a.map((record, idx) => (
                        <div key={idx} className="bg-gray-800/50 p-2.5 rounded text-xs md:text-sm text-gray-300">
                          <span className="font-mono text-white">{record.data}</span> <span className="text-gray-400">(cached for {formatTTL(record.TTL)})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {dnsRecords.aaaa && dnsRecords.aaaa.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-indigo-300 uppercase bg-indigo-900/20 p-2.5 rounded border border-indigo-500/30">📍 AAAA Records (IPv6 Addresses)</div>
                      <div className="text-xs md:text-sm text-gray-300 bg-gray-800/20 p-2.5 rounded mb-1.5">
                        Same as A records but for IPv6 addresses. The future of the internet! Longer addresses = way more possible IPs.
                      </div>
                      {dnsRecords.aaaa.map((record, idx) => (
                        <div key={idx} className="bg-gray-800/50 p-2.5 rounded text-xs md:text-sm text-gray-300 break-all">
                          <span className="font-mono text-white">{record.data}</span> <span className="text-gray-400">(cached for {formatTTL(record.TTL)})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {dnsRecords.cname && dnsRecords.cname.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-amber-300 uppercase bg-amber-900/20 p-2.5 rounded border border-amber-500/30">🔗 CNAME Records (Aliases)</div>
                      <div className="text-xs md:text-sm text-gray-300 bg-gray-800/20 p-2.5 rounded mb-1.5">
                        Creates an alias pointing one domain name to another. Like a shortcut or redirect. Useful for pointing multiple subdomains to the same server.
                      </div>
                      {dnsRecords.cname.map((record, idx) => (
                        <div key={idx} className="bg-gray-800/50 p-2.5 rounded text-xs md:text-sm text-gray-300">
                          <span className="font-mono text-white">{record.data}</span> <span className="text-gray-400">(cached for {formatTTL(record.TTL)})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {dnsRecords.mx && dnsRecords.mx.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-pink-300 uppercase bg-pink-900/20 p-2.5 rounded border border-pink-500/30">📧 MX Records (Mail Servers)</div>
                      <div className="text-xs md:text-sm text-gray-300 bg-gray-800/20 p-2.5 rounded mb-1.5">
                        Specifies mail servers for this domain. When someone sends email to you@domain.com, MX records tell email where to deliver it. Numbers = priority (lower = higher priority).
                      </div>
                      {dnsRecords.mx.map((record, idx) => (
                        <div key={idx} className="bg-gray-800/50 p-2.5 rounded text-xs md:text-sm text-gray-300">
                          <span className="font-mono text-white">{record.data}</span> <span className="text-gray-400">(cached for {formatTTL(record.TTL)})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {dnsRecords.txt && dnsRecords.txt.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-lime-300 uppercase bg-lime-900/20 p-2.5 rounded border border-lime-500/30">📝 TXT Records (Text Data)</div>
                      <div className="text-xs md:text-sm text-gray-300 bg-gray-800/20 p-2.5 rounded mb-1.5">
                        Arbitrary text data. Used for verification (proving you own the domain), email authentication (SPF, DKIM), and other metadata. Very versatile!
                      </div>
                      {dnsRecords.txt.map((record, idx) => (
                        <div key={idx} className="bg-gray-800/50 p-2.5 rounded text-xs md:text-sm text-gray-300 break-all">
                          <span className="font-mono text-white">{record.data}</span> <span className="text-gray-400">(cached for {formatTTL(record.TTL)})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {dnsRecords.ns && dnsRecords.ns.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-violet-300 uppercase bg-violet-900/20 p-2.5 rounded border border-violet-500/30">🖥️ NS Records (Nameservers)</div>
                      <div className="text-xs md:text-sm text-gray-300 bg-gray-800/20 p-2.5 rounded mb-1.5">
                        Lists the authoritative nameservers for this zone. These are the servers that have the "official" DNS records for this domain.
                      </div>
                      {dnsRecords.ns.map((record, idx) => (
                        <div key={idx} className="bg-gray-800/50 p-2.5 rounded text-xs md:text-sm text-gray-300">
                          <span className="font-mono text-white">{record.data}</span> <span className="text-gray-400">(cached for {formatTTL(record.TTL)})</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {!dnsRecords.soa && !dnsRecords.a && !dnsRecords.aaaa && !dnsRecords.cname && !dnsRecords.mx && !dnsRecords.txt && !dnsRecords.ns && (
                    <div className="text-sm text-gray-400 text-center py-3">No DNS records found</div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-400 text-center py-3">Failed to load DNS records</div>
              )}
            </div>
          )}
        </div>

        {/* WHOIS/RDAP Section - Educational (GREEN/EMERALD) */}
        <div className="border-2 border-green-400/40 rounded-lg overflow-hidden bg-gradient-to-r from-green-800/20 to-emerald-800/20">
          <button
            onClick={() => toggleSection('whois')}
            className="w-full flex items-center justify-between px-4 md:px-5 landscape:px-2 py-3 md:py-4 landscape:py-1 bg-green-800/30 hover:bg-green-800/40 transition-colors"
          >
            <span className="font-bold text-xl md:text-2xl landscape:text-xs text-green-200 uppercase tracking-wide">🌐 WHOIS / Registration Info</span>
            {expandedSections.whois ? (
              <ChevronUp className="w-5 h-5 md:w-6 md:h-6 landscape:w-3 landscape:h-3 text-green-300" />
            ) : (
              <ChevronDown className="w-5 h-5 md:w-6 md:h-6 landscape:w-3 landscape:h-3 text-green-300" />
            )}
          </button>
          {expandedSections.whois && (
            <div className="p-3 md:p-4 landscape:p-2 space-y-2 md:space-y-3 landscape:space-y-1.5 bg-gray-900/40">
              {loadingRdap ? (
                <div className="text-sm text-gray-400 text-center py-3">Loading...</div>
              ) : rdapData && !rdapData.error ? (
                <>
                  <div className="text-sm md:text-base text-green-200 bg-green-900/20 p-3 rounded-lg border border-green-500/20">
                    <strong>WHOIS</strong> (or RDAP) shows who registered this domain and when. Think of it as the domain's "registration card" at the DMV!
                  </div>

                  {rdapData.domain && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-green-300 uppercase">Domain Name</div>
                      <div className="bg-gray-800/50 p-2.5 rounded text-xs md:text-sm">
                        <div className="font-mono text-white mb-1.5">{rdapData.domain}</div>
                        <div className="text-gray-400">The official registered domain name.</div>
                      </div>
                    </div>
                  )}

                  {rdapData.registrar && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-cyan-300 uppercase">Registrar</div>
                      <div className="bg-gray-800/50 p-2.5 rounded text-xs md:text-sm">
                        <div className="text-white mb-1.5">{rdapData.registrar}</div>
                        <div className="text-gray-400">The company where this domain was purchased/registered. Like GoDaddy, Namecheap, Cloudflare, etc.</div>
                      </div>
                    </div>
                  )}

                  {rdapData.registrationDate && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-cyan-300 uppercase">Registration Date</div>
                      <div className="bg-gray-800/50 p-2.5 rounded text-xs md:text-sm">
                        <div className="text-white mb-1.5">{new Date(rdapData.registrationDate).toLocaleDateString()}</div>
                        <div className="text-gray-400">When this domain was first registered. Older domains are often more trusted by search engines!</div>
                      </div>
                    </div>
                  )}

                  {rdapData.expirationDate && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-cyan-300 uppercase">Expiration Date</div>
                      <div className="bg-gray-800/50 p-2.5 rounded text-xs md:text-sm">
                        <div className="text-white mb-1.5">{new Date(rdapData.expirationDate).toLocaleDateString()}</div>
                        <div className="text-gray-400">When this domain registration expires. Renew before this date or lose the domain!</div>
                      </div>
                    </div>
                  )}

                  {rdapData.status && rdapData.status.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs md:text-sm font-semibold text-cyan-300 uppercase">Status</div>
                      <div className="text-xs md:text-sm text-gray-400 bg-gray-800/20 p-2.5 rounded mb-1.5">
                        Domain status codes indicate locks, transfers, and other states. "clientTransferProhibited" = can't transfer easily (security feature).
                      </div>
                      <div className="space-y-1">
                        {rdapData.status.map((status, idx) => (
                          <div key={idx} className="bg-gray-800/50 p-2 rounded text-xs md:text-sm text-gray-300 font-mono">{status}</div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-sm text-gray-400 text-center py-3">
                  {rdapData?.error || 'WHOIS data not available (might be a subdomain or TLD)'}
                </div>
              )}
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default DnsRecordInspector;

