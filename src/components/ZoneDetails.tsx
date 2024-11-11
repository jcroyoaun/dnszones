import React from 'react';
import { X, Server, ExternalLink } from 'lucide-react';

interface ZoneDetailsProps {
  zone: {
    zone: string;
    domains: string[];
    nameservers: string[];
    isCname?: boolean;
    cnameTarget?: string;
  };
  onClose: () => void;
}

const ZoneDetails: React.FC<ZoneDetailsProps> = ({ zone, onClose }) => {
  if (!zone) return null;

  return (
    <div className="fixed right-4 top-4 w-96 bg-gray-800 rounded-lg shadow-xl border border-gray-700 p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-white">Zone Details</h3>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-gray-700 rounded-full text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-4">
        <div>
          <h4 className="font-medium mb-2 text-gray-300">Zone</h4>
          <p className="text-sm bg-gray-900 p-2 rounded text-white">{zone.zone}</p>
        </div>

        <div>
          <h4 className="font-medium mb-2 text-gray-300">Domains in this zone</h4>
          <ul className="text-sm space-y-2">
            {zone.domains.map((domain, idx) => (
              <li key={idx}>
                <div className="bg-gray-900 p-2 rounded text-white">
                  {domain}
                  {zone.isCname && domain !== zone.zone && (
                    <div className="mt-2 flex flex-col space-y-1">
                      <div className="flex items-center gap-1.5 px-2 py-1.5 rounded bg-purple-900/30 border border-purple-700/30">
                        <span className="text-purple-300 text-xs font-medium">CNAME</span>
                        <span className="text-purple-400 text-xs">→</span>
                        <span className="text-purple-300 text-[11px] font-medium truncate">{zone.cnameTarget}</span>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-medium mb-2 text-gray-300">Nameservers</h4>
          <ul className="text-sm space-y-1">
            {zone.nameservers.map((ns, idx) => (
              <li key={idx} className="bg-gray-900 p-2 rounded text-white flex items-center gap-2">
                <Server className="w-4 h-4 text-gray-400" />
                <span>{ns}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ZoneDetails;
