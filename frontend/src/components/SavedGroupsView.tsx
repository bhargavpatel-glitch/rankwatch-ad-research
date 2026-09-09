import React, { useState } from 'react';
import { Bookmark, Heart, Plus, Trash2, FolderPlus } from 'lucide-react';
import { AdGroup } from './SaveToGroupModal';
import { CanonicalAd, SearchResultItem } from '../types';
import { AdCard } from './AdCard';

interface SavedGroupsViewProps {
  groups: AdGroup[];
  allAdsMap: Map<string, CanonicalAd>;
  onSelectAd: (item: SearchResultItem) => void;
  onCreateGroup: (name: string, adIds: string[]) => Promise<void>;
  onDeleteGroup: (groupId: string) => Promise<void>;
  onRemoveAdFromGroup: (groupId: string, adId: string) => Promise<void>;
  debugMode: boolean;
}

export const SavedGroupsView: React.FC<SavedGroupsViewProps> = ({
  groups,
  allAdsMap,
  onSelectAd,
  onCreateGroup,
  onDeleteGroup,
  onRemoveAdFromGroup,
  debugMode
}) => {
  const [activeGroupId, setActiveGroupId] = useState<string>(groups[0]?.id || 'liked');
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const activeGroup = groups.find(g => g.id === activeGroupId) || groups[0];
  const groupAdIds = activeGroup ? activeGroup.adIds : [];

  const groupAds: SearchResultItem[] = groupAdIds
    .map(id => allAdsMap.get(id))
    .filter((ad): ad is CanonicalAd => !!ad)
    .map(ad => ({
      ad,
      score: 1.0,
      confidence: 'high',
      explanation: {
        matchedFields: ['saved'],
        exactMatch: false,
        brandMatch: false,
        scoreBreakdown: {
          exactScore: 0,
          brandScore: 0,
          phraseScore: 0,
          fieldScore: 1,
          semanticScore: 0,
          featureScore: 0,
          categoryScore: 0,
          platformScore: 0,
          total: 1
        },
        highlightTerms: [],
        explanationNote: `Saved in '${activeGroup?.name || 'Group'}'`
      }
    }));

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim() || isCreating) return;

    try {
      setIsCreating(true);
      await onCreateGroup(newGroupName.trim(), []);
      setNewGroupName('');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#0a0b0e] overflow-hidden select-none">
      {/* View Header */}
      <div className="p-6 border-b border-[#222630] bg-[#0f1115] flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Bookmark className="w-4 h-4 text-[#2fe593]" />
            <span>Saved Ad Groups & Collections</span>
          </h2>
          <p className="text-xs text-[#94a3b8] mt-0.5">
            Organize high-performing campaigns, reels, and competitor ads into targeted research sets.
          </p>
        </div>

        {/* Create Group Form */}
        <form onSubmit={handleCreateGroup} className="flex items-center gap-2">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="New group name..."
            className="px-3.5 py-2 rounded-xl bg-[#0a0b0e] border border-[#222630] text-xs text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#2fe593]"
          />
          <button
            type="submit"
            disabled={!newGroupName.trim() || isCreating}
            className="px-4 py-2 rounded-xl bg-[#2fe593] hover:bg-[#28d384] disabled:opacity-50 text-[#031a0f] text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#2fe593]/20 transition-all"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Add Group</span>
          </button>
        </form>
      </div>

      {/* Group Tabs Bar */}
      <div className="px-6 py-3 border-b border-[#222630] bg-[#0a0b0e] flex items-center gap-2 overflow-x-auto">
        {groups.map((g) => {
          const isActive = g.id === activeGroupId;
          const isLiked = g.id === 'liked';
          return (
            <div
              key={g.id}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#0e261a] text-[#2fe593] border border-[#2fe593] shadow-sm'
                  : 'bg-[#0f1115] text-[#94a3b8] hover:text-white hover:bg-[#181b21] border border-[#222630]'
              }`}
              onClick={() => setActiveGroupId(g.id)}
            >
              {isLiked ? <Heart className="w-3.5 h-3.5 fill-[#2fe593] text-[#2fe593]" /> : <FolderPlus className="w-3.5 h-3.5" />}
              <span>{g.name}</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                isActive ? 'bg-[#0a0b0e] text-[#2fe593] font-bold' : 'bg-[#181b21] text-[#94a3b8]'
              }`}>
                {g.adIds.length}
              </span>

              {!isLiked && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete group "${g.name}"?`)) {
                      onDeleteGroup(g.id);
                    }
                  }}
                  className="ml-1 p-0.5 rounded hover:bg-rose-500/20 hover:text-rose-300 text-[#64748b] transition-colors"
                  title="Delete this group"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Ads Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {groupAds.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-6">
            <div className="w-14 h-14 rounded-2xl bg-[#13151a] border border-[#222630] flex items-center justify-center mb-3">
              <Bookmark className="w-6 h-6 text-[#2fe593]" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              No ads saved in "{activeGroup?.name || 'this group'}"
            </h3>
            <p className="text-xs text-[#94a3b8] max-w-sm">
              Click the heart or bookmark icon on any ad card in the Ad Library to save it here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-5">
            {groupAds.map((item) => (
              <div key={item.ad.id} className="relative group/card">
                <AdCard
                  item={item}
                  onSelect={() => onSelectAd(item)}
                  debugMode={debugMode}
                  isLiked={activeGroupId === 'liked'}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (activeGroup) {
                      onRemoveAdFromGroup(activeGroup.id, item.ad.id);
                    }
                  }}
                  className="absolute top-3 right-11 z-30 p-1.5 rounded-lg bg-rose-950/90 text-rose-300 border border-rose-800/80 hover:bg-rose-900 hover:text-white transition-all opacity-0 group-hover/card:opacity-100 shadow-md backdrop-blur-sm"
                  title="Remove from this group"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
