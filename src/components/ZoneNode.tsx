import React, { memo, useState } from 'react';
import { Handle, Position } from 'reactflow';
import { Server } from 'lucide-react';

const getZoneClasses = (depth: number) => {
  switch (depth) {
    case 0: return {
      bg: 'bg-zone-root',
      border: 'border-zone-root-border'
    };
    case 1: return {
      bg: 'bg-zone-tld',
      border: 'border-zone-tld-border'
    };
    case 2: return {
      bg: 'bg-zone-domain',
      border: 'border-zone-domain-border'
    };
    default: return {
      bg: 'bg-zone-subdomain',
      border: 'border-zone-subdomain-border'
    };
  }
};

const ZoneNode = memo(({ data }: { 
  data: { 
    label: string; 
    zone: string;
    domains: string[];
    onZoneClick: (zone: string) => void;
    depth: number;
    isCname?: boolean;
    cnameTarget?: string;
  }
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const zoneClasses = getZoneClasses(data.depth);

  // Find the apex domain (usually the shortest one or the zone name itself)
  const apexDomain = data.domains.find(d => d === data.zone) || data.domains[0];
  const subDomains = data.domains.filter(d => d !== apexDomain);

  return (
    <div 
      className={`px-6 py-4 shadow-2xl rounded-xl border-2 transition-all duration-300 min-w-[200px] cursor-pointer backdrop-blur-sm
        ${isHovered 
          ? `${zoneClasses.bg} ${zoneClasses.border} scale-105 shadow-cyan-500/30` 
          : 'bg-gray-800/90 border-gray-600/50 hover:border-gray-500/50'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => data.onZoneClick(data.zone)}
    >
      <Handle type="target" position={Position.Top} className="w-3 h-3 !bg-cyan-500 !border-2 !border-gray-800" />
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg transition-all duration-300 ${isHovered ? 'bg-white/10' : 'bg-gray-700/50'}`}>
          <Server className={`w-5 h-5 transition-colors duration-300 ${isHovered ? 'text-cyan-300' : 'text-gray-400'}`} />
        </div>
        <div className="flex flex-col">
          <div className={`text-base font-bold transition-colors duration-300 ${isHovered ? 'text-white' : 'text-gray-100'}`}>
            {apexDomain}
          </div>
          {subDomains.map((domain) => (
            <div 
              key={domain}
              className={`text-sm font-medium transition-colors duration-300 ${isHovered ? 'text-gray-200' : 'text-gray-400'}`}
            >
              {domain}
            </div>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-3 h-3 !bg-cyan-500 !border-2 !border-gray-800" />
    </div>
  );
});

ZoneNode.displayName = 'ZoneNode';

export default ZoneNode;
