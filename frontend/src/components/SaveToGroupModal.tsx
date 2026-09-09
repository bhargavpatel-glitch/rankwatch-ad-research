import React, { useState } from 'react';
import { X, Plus, Check, Bookmark, Heart } from 'lucide-react';

export interface AdGroup {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  adIds: string[];
}

interface SaveToGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedAdIds: string[];
  groups: AdGroup[];
  onSaveToGroup: (groupId: string, adIds: string[]) => Promise<void>;
  onCreateGroup: (name: string, adIds: string[]) => Promise<void>;
}

export const SaveToGroupModal: React.FC<SaveToGroupModalProps> = ({
  isOpen,
  onClose,
  selectedAdIds,
  groups,
  onSaveToGroup,
  onCreateGroup
}) => {
  const [newGroupName, setNewGroupName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [savingGroupId, setSavingGroupId] = useState<string | null>(null);
  const [savedSuccess, setSavedSuccess] = useState<string | null>(null);

  if (!isOpen || selectedAdIds.length === 0) return null;

  const handleSelectGroup = async (groupId: string) => {
    setSavingGroupId(groupId);
    await onSaveToGroup(groupId, selectedAdIds);
    setSavedSuccess(groupId);
    setTimeout(() => {
      setSavingGroupId(null);
      setSavedSuccess(null);
      onClose();
    }, 600);
  };

  const handleCreateGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    setIsCreating(true);
    await onCreateGroup(newGroupName.trim(), selectedAdIds);
    setIsCreating(false);
    setNewGroupName('');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-md bg-[#0f1115] border border-[#222630] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="h-14 px-5 border-b border-[#222630] flex items-center justify-between bg-[#0a0b0e]">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-[#0e261a] border border-[#184530] flex items-center justify-center text-[#2fe593]">
              <Bookmark className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white">
                Save {selectedAdIds.length} {selectedAdIds.length === 1 ? 'Ad' : 'Ads'} to Group
              </h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-[#13151a] hover:bg-[#181b21] text-[#94a3b8] hover:text-white transition-colors border border-[#222630]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Existing Groups List */}
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            <span className="text-[10.5px] font-bold text-[#64748b] uppercase tracking-wider block mb-1">
              Select Destination Group
            </span>
            {groups.map((group) => {
              const isLiked = group.id === 'liked';
              const isSaved = savedSuccess === group.id;
              const isSaving = savingGroupId === group.id;
              return (
                <button
                  key={group.id}
                  onClick={() => handleSelectGroup(group.id)}
                  disabled={isSaving}
                  className="w-full flex items-center justify-between p-3 rounded-xl bg-[#13151a] hover:bg-[#181b21] border border-[#222630] hover:border-[#2fe593]/40 transition-all text-left group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center bg-[#0e261a] text-[#2fe593] border border-[#184530]">
                      {isLiked ? <Heart className="w-3.5 h-3.5 fill-[#2fe593]" /> : <Bookmark className="w-3.5 h-3.5 fill-[#2fe593]" />}
                    </div>
                    <div>
                      <span className="font-bold text-xs text-white group-hover:text-[#2fe593] transition-colors">
                        {group.name}
                      </span>
                      <span className="text-[10px] text-[#94a3b8] block">
                        {group.adIds.length} {group.adIds.length === 1 ? 'ad' : 'ads'} saved
                      </span>
                    </div>
                  </div>

                  <div>
                    {isSaved ? (
                      <span className="text-[#2fe593] text-xs font-bold flex items-center gap-1">
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Saved
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-[#2fe593] opacity-0 group-hover:opacity-100 transition-opacity">
                        Save here →
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-[#222630] pt-3">
            <span className="text-[10.5px] font-bold text-[#64748b] uppercase tracking-wider block mb-2">
              Or Create New Group
            </span>
            <form onSubmit={handleCreateGroupSubmit} className="flex gap-2">
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="e.g. Competitor UGC Hooks, Q4 Pricing..."
                className="flex-1 px-3 py-2 rounded-xl bg-[#0a0b0e] border border-[#222630] text-xs text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#2fe593]"
              />
              <button
                type="submit"
                disabled={!newGroupName.trim() || isCreating}
                className="px-4 py-2 rounded-xl bg-[#2fe593] hover:bg-[#28d384] disabled:opacity-50 text-[#031a0f] text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#2fe593]/20 transition-all"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Create & Save</span>
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
