import React from 'react';
import { SearchX, RotateCcw, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onReset: () => void;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ onReset }) => {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#13151a] border border-[#222630] flex items-center justify-center mb-4 shadow-xl">
        <SearchX className="w-8 h-8 text-[#64748b]" />
      </div>

      <h3 className="text-base font-bold text-white mb-1.5">
        No advertisements found
      </h3>
      <p className="text-xs text-[#94a3b8] max-w-md mb-6 leading-relaxed">
        We couldn't find any advertisements matching your query and active filters. Try broadening your terms or resetting filters.
      </p>

      <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
        <span className="text-[11px] text-[#64748b] font-medium">Try searching:</span>
        {['AI search', 'Semrush enterprise', 'Answer engine optimization', 'Document Ad', 'Peec AI'].map((term) => (
          <button
            key={term}
            onClick={() => {
              // Dispatch custom event to update search
              window.dispatchEvent(new CustomEvent('search:suggest', { detail: term }));
            }}
            className="text-xs px-2.5 py-1 rounded-lg bg-[#13151a] hover:bg-[#181b21] text-[#cbd5e1] hover:text-white border border-[#222630] transition-colors"
          >
            {term}
          </button>
        ))}
      </div>

      <button
        onClick={onReset}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#2fe593] hover:bg-[#28d384] text-[#031a0f] text-xs font-bold shadow-lg shadow-[#2fe593]/20 transition-all active:scale-95"
      >
        <RotateCcw className="w-3.5 h-3.5 stroke-[2.5]" />
        <span>Reset All Filters & Search</span>
      </button>
    </div>
  );
};
