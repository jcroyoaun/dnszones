import React, { useState, useEffect } from 'react';
import ReactFlow, { 
  Background, 
  Controls,
  ConnectionMode,
  Node,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Globe, X } from 'lucide-react';
import packageJson from '../package.json';

import ZoneNode from './components/ZoneNode';
import ZoneDetails from './components/ZoneDetails';
import { buildZoneTree } from './utils/dns';
import { RESOLVERS, DEFAULT_RESOLVER, type DnsResolver } from './config/resolvers';
import { APP_CONFIG } from './config/app';
import { RateLimitError } from './utils/rate-limiter';

const nodeTypes = {
  zoneNode: ZoneNode
};

const APP_VERSION = packageJson.version;

function App() {
  const [domain, setDomain] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedZone, setSelectedZone] = useState<{
    zone: string;
    domains: string[];
    nameservers: string[];
    isCname?: boolean;
    cnameTarget?: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedResolver, setSelectedResolver] = useState<DnsResolver>(DEFAULT_RESOLVER);

  // Load saved resolver preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(APP_CONFIG.RESOLVER_STORAGE_KEY);
    if (saved) {
      const resolver = RESOLVERS.find(r => r.id === saved);
      if (resolver) {
        setSelectedResolver(resolver);
      }
    }
  }, []);

  // Save resolver preference to localStorage when it changes
  const handleResolverChange = (resolverId: string) => {
    const resolver = RESOLVERS.find(r => r.id === resolverId);
    if (resolver) {
      setSelectedResolver(resolver);
      localStorage.setItem(APP_CONFIG.RESOLVER_STORAGE_KEY, resolver.id);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain) return;
    const cleanDomain = sanitizeDomain(domain);
    setLoading(true);
    setError(null);
    setSelectedZone(null);
    setNodes([]);
    setEdges([]);

    try {
      const { nodes: newNodes, edges: newEdges } = await buildZoneTree(cleanDomain, selectedResolver.endpoint);
      
      const nodesWithHandlers = newNodes.map(node => ({
        ...node,
        data: {
          ...node.data,
          onZoneClick: (zone: string) => {
            const zoneData = node.data;
            if (zoneData.zone === zone) {
              setSelectedZone(zoneData);
            }
          }
        }
      }));
      
      setNodes(nodesWithHandlers);
      setEdges(newEdges);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error('Error building zone tree:', error);
      }
      
      if (error instanceof RateLimitError) {
        const seconds = Math.ceil(error.resetTimeMs / 1000);
        setError(`Rate limit exceeded. Please wait ${seconds} seconds before trying again.`);
      } else if (error instanceof Error) {
        setError(error.message);
      } else {
        setError('Failed to query DNS records. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const sanitizeDomain = (input: string): string => {
    try {
      // Try to parse as URL first (handles full URLs)
      let domain;
      try {
        const url = new URL(input);
        domain = url.hostname;
      } catch {
        // Not a URL, treat as direct domain input
        domain = input;
      }
      
      // Remove protocol prefixes and paths
      domain = domain.replace(/^https?:\/\//, '').split('/')[0].split(':')[0];
      
      // Ensure consistent case and no extra spaces
      domain = domain.toLowerCase().trim();
      
      // Preserve trailing dot if present, otherwise domain is unchanged
      return domain;
    } catch {
      return input.toLowerCase().trim();
    }
  };
    
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      <div className="border-b border-gray-700/50 p-6 bg-gradient-to-r from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-sm shadow-2xl">
        <div className="max-w-2xl mx-auto text-center mb-6">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent mb-3 tracking-tight">
            DNS Zone Visualizer
          </h1>
          <p className="text-gray-300 text-base mb-2 font-medium">
            Enter a domain name to visualize its DNS zone hierarchy and delegation structure.
          </p>
          <p className="text-gray-400 text-sm">
            Try domains like <span className="text-cyan-400 font-semibold">example.com</span> or <span className="text-cyan-400 font-semibold">subdomain.example.co.uk</span>
          </p>
        </div>
        
        <div className="relative w-full px-8">
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-3">
            <input
              type="text"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Enter domain (e.g., google.com, es.wikipedia.org)"
              className="flex-1 px-5 py-3 bg-gray-800/80 border border-gray-600/50 rounded-xl focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 text-white placeholder-gray-400 transition-all duration-200 shadow-lg focus:shadow-cyan-500/20"
            />
            
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-semibold rounded-xl hover:from-blue-500 hover:to-cyan-500 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-cyan-500/30 hover:scale-105"
            >
              {loading ? 'Searching...' : 'Search'}
            </button>
          </form>
          
          <div className="absolute right-8 top-0 flex gap-2 items-center opacity-75 hover:opacity-100 transition-opacity">
            <label htmlFor="resolver-select" className="text-[10px] text-gray-400 whitespace-nowrap">
              Select DNS resolver:
            </label>
            <select
              id="resolver-select"
              value={selectedResolver.id}
              onChange={(e) => handleResolverChange(e.target.value)}
              className="px-3 py-3 bg-gray-800/60 border border-gray-700/30 rounded-lg text-gray-300 text-xs focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200 cursor-pointer hover:border-gray-600/50 hover:text-gray-200"
              aria-label="Select DNS resolver"
              title="DNS Resolver"
            >
              {RESOLVERS.map((resolver) => (
                <option key={resolver.id} value={resolver.id}>
                  {resolver.name}
                </option>
              ))}
            </select>
            <p className="text-[10px] text-gray-400 leading-tight w-16">
              DNS over HTTPS
            </p>
          </div>
        </div>
        {error && (
          <div className="max-w-2xl mx-auto mt-3 text-red-400 text-sm bg-red-900/20 border border-red-500/30 rounded-lg px-4 py-2">
            {error}
          </div>
        )}
      </div>
      <div className="flex-1 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
        {(nodes.length > 0 || edges.length > 0) && (
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            defaultViewport={{ x: 0, y: 0, zoom: 1 }}
            minZoom={0.2}
            maxZoom={1.5}
            fitView
          >
            <Background color="#374151" gap={16} />
            <Controls className="dark:bg-gray-800 dark:border-gray-700" />
          </ReactFlow>
        )}
      </div>

      {selectedZone && (
        <ZoneDetails
          zone={selectedZone}
          onClose={() => setSelectedZone(null)}
        />
      )}
      <footer className="border-t border-gray-700/50 bg-gradient-to-r from-gray-900/95 via-gray-800/95 to-gray-900/95 backdrop-blur-sm py-6 shadow-2xl">
        <div className="w-full px-8">
          <div className="flex items-start justify-between gap-8">
            {/* Left: Name and Version */}
            <div className="text-left">
              <div className="text-gray-300 text-sm">© 2025 DNS Zone Visualizer</div>
              <span className="inline-block mt-2 text-xs bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border border-cyan-500/30 px-3 py-1 rounded-full font-semibold text-cyan-300">v{APP_VERSION}</span>
            </div>

            {/* Middle: Disclaimer */}
            <div className="text-center text-xs text-gray-400 max-w-2xl">
              <p className="text-gray-400">
                A DNS zone hierarchy visualization tool using DNS over HTTPS (DoH) to query and display domain information. Intended for educational purposes only.
              </p>
              <p className="text-gray-400 mt-2">
                Note: DNS zone relationships shown may occasionally be incomplete or inaccurate.
                {' '}
                Found any issues? <a href="mailto:contact@dnszone.dev" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">Let us know</a>.
              </p>
            </div>

            {/* Right: Social Icons */}
            <div className="flex items-center justify-end gap-4">
              <a 
                href="https://github.com/jcroyoaun" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-cyan-400 transition-all duration-200 hover:scale-110"
                aria-label="GitHub"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
              </a>
              <a 
                href="https://x.com/jcroyoaun" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-cyan-400 transition-all duration-200 hover:scale-110"
                aria-label="X (Twitter)"
              >
                <X className="w-5 h-5" />
              </a>
              <a 
                href="https://jcroyoaun.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-cyan-400 transition-all duration-200 hover:scale-110"
                aria-label="Website"
              >
                <Globe className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;