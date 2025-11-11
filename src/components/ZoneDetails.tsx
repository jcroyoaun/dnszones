import React, { useState, useCallback } from 'react';
import { X, Server, ZoomIn, ZoomOut } from 'lucide-react';

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
  const [zoom, setZoom] = useState(100);
  // Responsive initial position - centered on mobile, right-aligned on desktop
  const getInitialPosition = () => {
    const width = window.innerWidth;
    const isMobile = width < 768;
    return {
      x: isMobile ? Math.max(16, (width - 384) / 2) : width - 400 - 16,
      y: 16
    };
  };
  const [position, setPosition] = useState(getInitialPosition());
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -5 : 5;
      setZoom(prev => Math.max(50, Math.min(150, prev + delta)));
    }
  }, []);

  const zoomIn = useCallback(() => {
    setZoom(prev => Math.min(150, prev + 10));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(prev => Math.max(50, prev - 10));
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(100);
  }, []);

  // Mouse events for desktop
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  }, [position]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    setPosition({
      x: e.clientX - dragOffset.x,
      y: e.clientY - dragOffset.y
    });
  }, [isDragging, dragOffset]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    setIsDragging(true);
    setDragOffset({
      x: touch.clientX - position.x,
      y: touch.clientY - position.y
    });
  }, [position]);

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!isDragging) return;
    
    const touch = e.touches[0];
    setPosition({
      x: touch.clientX - dragOffset.x,
      y: touch.clientY - dragOffset.y
    });
  }, [isDragging, dragOffset]);

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp, handleTouchMove, handleTouchEnd]);

  if (!zone) return null;

  return (
    <div 
      className="fixed w-[calc(100vw-32px)] max-w-96 bg-gradient-to-br from-gray-800/95 to-gray-900/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-600/50 flex flex-col max-h-[calc(100vh-180px)] z-50"
      onWheel={handleWheel}
      style={{ 
        transform: `scale(${zoom / 100})`,
        transformOrigin: 'top left',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: isDragging ? 'grabbing' : 'default'
      }}
    >
      <div 
        className="flex justify-between items-center px-4 py-3 flex-shrink-0 cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">Zone Details</h3>
          <div className="flex items-center gap-0.5 bg-gray-700/50 rounded-lg px-1.5 py-0.5" onMouseDown={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()}>
            <button
              onClick={zoomOut}
              className="p-0.5 hover:bg-gray-600/50 rounded text-gray-400 hover:text-cyan-400 transition-all"
              title="Zoom out (Ctrl/Cmd + scroll)"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <button
              onClick={resetZoom}
              className="px-1.5 py-0.5 text-[10px] text-gray-400 hover:text-cyan-400 transition-colors font-mono"
              title="Reset zoom"
            >
              {zoom}%
            </button>
            <button
              onClick={zoomIn}
              className="p-0.5 hover:bg-gray-600/50 rounded text-gray-400 hover:text-cyan-400 transition-all"
              title="Zoom in (Ctrl/Cmd + scroll)"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
        <button 
          onClick={onClose}
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          className="p-1.5 hover:bg-gray-700/50 rounded-lg text-gray-400 hover:text-cyan-400 transition-all duration-200 hover:scale-110"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="space-y-3 overflow-y-auto px-4 pb-4 flex-1 scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800/50">
        <div>
          <h4 className="font-semibold mb-1.5 text-cyan-300 text-xs uppercase tracking-wide">Zone</h4>
          <p className="text-xs bg-gray-900/60 p-2 rounded-lg text-white font-medium border border-gray-700/50">{zone.zone}</p>
        </div>

        <div>
          <h4 className="font-semibold mb-1.5 text-cyan-300 text-xs uppercase tracking-wide">Domains in this zone</h4>
          <ul className="text-xs space-y-1.5">
            {zone.domains.map((domain, idx) => (
              <li key={idx}>
                <div className="bg-gray-900/60 p-2 rounded-lg text-white border border-gray-700/50 hover:border-cyan-500/30 transition-colors duration-200">
                  {domain}
                  {zone.isCname && domain !== zone.zone && (
                    <div className="mt-1.5 flex flex-col space-y-1">
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-gradient-to-r from-purple-900/40 to-pink-900/40 border border-purple-500/40">
                        <span className="text-purple-300 text-[10px] font-semibold">CNAME</span>
                        <span className="text-purple-400 text-[10px]">→</span>
                        <span className="text-purple-300 text-[10px] font-medium truncate">{zone.cnameTarget}</span>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-1.5 text-cyan-300 text-xs uppercase tracking-wide">Nameservers</h4>
          <ul className="text-xs space-y-1.5">
            {zone.nameservers.map((ns, idx) => (
              <li key={idx} className="bg-gray-900/60 p-2 rounded-lg text-white flex items-center gap-2 border border-gray-700/50 hover:border-cyan-500/30 transition-colors duration-200">
                <div className="p-1 bg-cyan-500/10 rounded">
                  <Server className="w-3 h-3 text-cyan-400" />
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
