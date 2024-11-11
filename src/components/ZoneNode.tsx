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
      className={`px-6 py-4 shadow-lg rounded-lg border-2 transition-all duration-200 min-w-[200px] cursor-pointer
        ${isHovered 
          ? `${zoneClasses.bg} ${zoneClasses.border}` 
          : 'bg-gray-800 border-gray-700'}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => data.onZoneClick(data.zone)}
    >
      <Handle type="target" position={Position.Top} className="w-2 h-2 !bg-gray-600" />
      <div className="flex items-center gap-3">
        <Server className={`w-5 h-5 ${isHovered ? 'text-white' : 'text-gray-400'}`} />
        <div className="flex flex-col">
          <div className="text-base font-bold text-white">
            {apexDomain}
          </div>
          {subDomains.map((domain) => (
            <div 
              key={domain}
              className="text-sm font-medium text-gray-400"
            >
              {domain}
            </div>
          ))}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="w-2 h-2 !bg-gray-600" />
    </div>
  );
});

ZoneNode.displayName = 'ZoneNode';

export default ZoneNode;
