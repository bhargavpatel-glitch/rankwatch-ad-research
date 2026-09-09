import React from 'react';
import { Bookmark, Heart, X, Check } from 'lucide-react';

interface BulkActionBarProps {
  selectedCount: number;
  onSaveToLiked: () => void;
  onOpenSaveToGroup: () => void;
  onClearSelection: () => void;
}

export const BulkActionBar: React.FC<BulkActionBarProps> = ({
  selectedCount,
  onSaveToLiked,
  onOpenSaveToGroup,
  onClearSelection
}) => {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-3 px-5 py-3 rounded-2xl bg-[#0f1115]/95 border border-[#222630] shadow-2xl backdrop-blur-md text-white">
        <div className="flex items-center gap-2 pr-3 border-r border-[#222630]">
          <div className="w-5 h-5 rounded-md bg-[#10b981] flex items-center justify-center text-[#031a0f]">
            <Check className="w-3 h-3 stroke-[3]" />
          </div>
          <span className="text-xs font-bold font-mono text-[#f8fafc]">
            {selectedCount} {selectedCount === 1 ? 'ad' : 'ads'} selected
          </span>
        </div>

        {/* Action 1: Save to Liked Ads */}
        <button
          onClick={onSaveToLiked}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#0e261a] hover:bg-[#133524] text-[#2fe593] border border-[#2fe593]/40 text-xs font-semibold transition-all active:scale-95"
        >
          <Heart className="w-3.5 h-3.5 fill-[#2fe593]" />
          <span>Save to Liked</span>
        </button>

        {/* Action 2: Save to Custom Group */}
        <button
          onClick={onOpenSaveToGroup}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#181b21] hover:bg-[#222630] text-white border border-[#222630] text-xs font-bold shadow-md transition-all active:scale-95"
        >
          <Bookmark className="w-3.5 h-3.5 text-[#2fe593]" />
          <span>Save to Group...</span>
        </button>

        {/* Action 3: Clear Selection */}
        <button
          onClick={onClearSelection}
          className="p-1.5 rounded-lg text-[#94a3b8] hover:text-white hover:bg-[#181b21] transition-colors ml-1"
          title="Clear selection"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
