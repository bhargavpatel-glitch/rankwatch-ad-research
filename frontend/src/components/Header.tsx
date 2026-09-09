import React, { useState, useRef, useEffect } from 'react';
import { Search, X, Sparkles, RefreshCw } from 'lucide-react';
import { SyncStatus } from '../types';

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: (query: string) => void;
  debugMode?: boolean;
  onToggleDebug?: () => void;
  syncStatus: SyncStatus | null;
  onTriggerSync: () => void;
  suggestedQueries?: string[];
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  debugMode,
  onToggleDebug,
  syncStatus,
  onTriggerSync,
  suggestedQueries = []
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === '/' || (e.ctrlKey && e.key === 'k')) && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const defaultPopularSuggestions = [
    'AI search and GEO',
    'Semrush enterprise',
    'Peec AI reel',
    'Answer engine optimization',
    'Profound marketing agent',
    'Document Ad carousel',
    'Free trial pricing',
    'Case study MongoDB'
  ];

  const suggestionsToShow = suggestedQueries.length > 0 ? suggestedQueries : defaultPopularSuggestions;

  return (
    <header className="h-16 border-b border-[#222630] bg-[#0a0b0e]/95 backdrop-blur-md px-6 flex items-center justify-between gap-4 sticky top-0 z-30 select-none">
      {/* Search Bar Container */}
      <div className="relative flex-1 max-w-2xl">
        <div
          className={`flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-[#0f1115] border transition-all duration-200 ${
            isFocused
              ? 'border-[#2fe593] shadow-lg shadow-[#2fe593]/15 ring-1 ring-[#2fe593]/30'
              : 'border-[#222630] hover:border-[#2d3340]'
          }`}
        >
          <Search className={`w-4 h-4 flex-shrink-0 transition-colors ${isFocused ? 'text-[#2fe593]' : 'text-[#64748b]'}`} />
          <input
            ref={inputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                onSearchSubmit(searchQuery);
                setIsFocused(false);
              }
            }}
            placeholder="Search ads, brands, features, platforms, concepts (e.g. 'AEO', 'Semrush', 'AI video')..."
            className="w-full bg-transparent text-xs text-white placeholder:text-[#64748b] focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => {
                onSearchChange('');
                inputRef.current?.focus();
              }}
              className="text-[#94a3b8] hover:text-white p-0.5 rounded transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="hidden sm:flex items-center justify-center w-5 h-5 text-[11px] font-mono text-[#94a3b8] bg-[#13151a] rounded-md border border-[#222630]">
            <span>/</span>
          </div>
        </div>

        {/* Search Suggestions Dropdown */}
        {isFocused && (
          <div className="absolute left-0 right-0 top-full mt-2 bg-[#0f1115] border border-[#222630] rounded-2xl shadow-2xl p-3 z-50 animate-in fade-in slide-in-from-top-1 duration-150">
            <div className="text-[10.5px] font-bold text-[#64748b] uppercase tracking-wider mb-2 px-2 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3 text-[#2fe593]" />
              Suggested Search Concepts
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {suggestionsToShow.map((item, idx) => (
                <button
                  key={idx}
                  onMouseDown={() => {
                    onSearchChange(item);
                    onSearchSubmit(item);
                    setIsFocused(false);
                  }}
                  className="flex items-center gap-2 text-left px-3 py-2 rounded-xl text-xs text-[#cbd5e1] hover:text-white hover:bg-[#181b21] transition-colors"
                >
                  <Search className="w-3 h-3 text-[#64748b]" />
                  <span className="truncate">{item}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Header Actions */}
      <div className="flex items-center gap-3">
        {/* Mint Solid Sync Now Button */}
        <button
          onClick={onTriggerSync}
          disabled={syncStatus?.isSyncing}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
            syncStatus?.isSyncing
              ? 'bg-[#181b21] text-[#64748b] cursor-not-allowed border border-[#222630]'
              : 'bg-[#2fe593] hover:bg-[#28d384] text-[#031a0f] shadow-lg shadow-[#2fe593]/20 active:scale-95'
          }`}
        >
          <RefreshCw className={`w-3.5 h-3.5 stroke-[2.5] ${syncStatus?.isSyncing ? 'animate-spin text-[#64748b]' : 'text-[#031a0f]'}`} />
          <span>{syncStatus?.isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      </div>
    </header>
  );
};
