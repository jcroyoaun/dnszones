import React, { useState, useCallback } from 'react';
import ReactFlow, { 
  Background, 
  Controls,
  ConnectionMode,
  Node,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Github, Globe, Twitter } from 'lucide-react';


import ZoneNode from './components/ZoneNode';
import ZoneDetails from './components/ZoneDetails';
import { buildZoneTree } from './utils/dns';

const nodeTypes = {
  zoneNode: ZoneNode
};

const APP_VERSION = '0.1.0';

function App() {
  const [domain, setDomain] = useState('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const { nodes: newNodes, edges: newEdges } = await buildZoneTree(cleanDomain);
      
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
      console.error('Error building zone tree:', error);
      if (error instanceof Error) {
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
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center mb-4">
            <div className="text-gray-300">
              © 2025 DNS Zone Visualizer <span className="text-xs ml-2 bg-gradient-to-r from-blue-600/30 to-cyan-600/30 border border-cyan-500/30 px-3 py-1 rounded-full font-semibold text-cyan-300">v{APP_VERSION}</span>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="https://github.com/jcroyoaun" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-cyan-400 transition-all duration-200 hover:scale-110"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a 
                href="https://x.com/jcroyoaun" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-cyan-400 transition-all duration-200 hover:scale-110"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
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
          
          <div className="text-center max-w-2xl mx-auto text-xs text-gray-400">
            <p className="text-gray-400">
              This visualization tool is provided for educational purposes only.
            </p>
            <p className="text-gray-400">
              DNS zone relationships shown may occasionally be incomplete or inaccurate.

              Found any issues? <a href="mailto:contact@dnszone.dev" className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium">Let us know</a>.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;