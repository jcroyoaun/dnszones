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

const APP_VERSION = '0.0.1-beta';

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
    <div className="h-screen flex flex-col dark:bg-gray-900">
      <div className="border-b border-gray-700 p-4 bg-gray-900">
        <div className="max-w-2xl mx-auto text-center mb-6">
          <h1 className="text-2xl font-bold text-white mb-2">DNS Zone Visualizer</h1>
          <p className="text-gray-400 text-sm mb-2">
            Enter a domain name to visualize its DNS zone hierarchy and delegation structure.
          </p>
          <p className="text-gray-400 text-sm">
            Try domains like <span className="text-blue-400">example.com</span> or <span className="text-blue-400">subdomain.example.co.uk</span>
          </p>
        </div>
        
        <form onSubmit={handleSearch} className="max-w-2xl mx-auto flex gap-2">
          <input
            type="text"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="Enter domain (e.g., google.com, es.wikipedia.org)"
            className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-white placeholder-gray-400"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:opacity-50"
          >
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {error && (
          <div className="max-w-2xl mx-auto mt-2 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>
      <div className="flex-1 bg-gray-900">
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
      <footer className="border-t border-gray-800 bg-gray-900 py-4">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between items-center mb-4">
            <div className="text-gray-400">
              © 2024 DNS Zone Visualizer <span className="text-xs ml-2 bg-gray-800 px-2 py-1 rounded-full">v{APP_VERSION}</span>
            </div>
            <div className="flex items-center gap-4">
              <a 
                href="https://github.com/jcroyoaun" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="GitHub"
              >
                <Github className="w-5 h-5" />
              </a>
              <a 
                href="https://x.com/jcroyoaun" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
              <a 
                href="https://jcroyoaun.io" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
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

              Found any issues? <a href="mailto:contact@dnszone.dev" className="text-blue-400 hover:text-blue-300 transition-colors">Let us know</a>.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;