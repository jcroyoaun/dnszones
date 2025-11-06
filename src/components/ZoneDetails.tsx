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
    <div className="fixed right-4 top-4 w-96 bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-600/50 p-5 animate-in slide-in-from-right duration-300">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Zone Details</h3>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-cyan-400 transition-all duration-200 hover:scale-110"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="space-y-5">
        <div>
          <h4 className="font-semibold mb-2 text-cyan-300 text-sm uppercase tracking-wide">Zone</h4>
          <p className="text-sm bg-gray-900/60 p-3 rounded-lg text-white font-medium border border-gray-700/50">{zone.zone}</p>
        </div>

        <div>
          <h4 className="font-semibold mb-3 text-cyan-300 text-sm uppercase tracking-wide">Domains in this zone</h4>
          <ul className="text-sm space-y-2">
            {zone.domains.map((domain, idx) => (
              <li key={idx}>
                <div className="bg-gray-900/60 p-3 rounded-lg text-white border border-gray-700/50 hover:border-cyan-500/30 transition-colors duration-200">
                  {domain}
                  {zone.isCname && domain !== zone.zone && (
                    <div className="mt-2 flex flex-col space-y-1">
                      <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/40">
                        <span className="text-purple-300 text-xs font-semibold">CNAME</span>
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
          <h4 className="font-semibold mb-3 text-cyan-300 text-sm uppercase tracking-wide">Nameservers</h4>
          <ul className="text-sm space-y-2">
            {zone.nameservers.map((ns, idx) => (
              <li key={idx} className="bg-gray-900/60 p-3 rounded-lg text-white flex items-center gap-3 border border-gray-700/50 hover:border-cyan-500/30 transition-colors duration-200">
                <div className="p-1.5 bg-cyan-500/10 rounded-lg">
                  <Server className="w-4 h-4 text-cyan-400" />
                </div>
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
