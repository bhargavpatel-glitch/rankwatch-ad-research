import React from 'react';
import { Layers, Compass, Bookmark, Database, Cloud, ShieldAlert } from 'lucide-react';
import { SyncStatus } from '../types';
import { isSupabaseConfigured } from '../utils/supabaseClient';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  syncStatus: SyncStatus | null;
  totalAds: number;
  savedAdsCount: number;
  onOpenDataSources: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  syncStatus,
  totalAds,
  savedAdsCount,
  onOpenDataSources,
}) => {
  const isCloudConnected = isSupabaseConfigured();

  const navItems = [
    { id: 'library', label: 'Ad Library', icon: Layers, count: totalAds },
    { id: 'explore', label: 'Explore Concepts', icon: Compass },
    { id: 'groups', label: 'Saved Groups', icon: Bookmark, count: savedAdsCount },
    { id: 'sources', label: 'Data Sources', icon: Database, action: onOpenDataSources },
  ];

  return (
    <aside className="w-64 bg-[#0a0b0e] border-r border-[#222630] flex flex-col flex-shrink-0 select-none z-20">
      {/* Brand Header */}
      <div className="h-16 flex items-center px-6 border-b border-[#222630] gap-3">
        {/* Emerald Brand Icon */}
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#10b981] to-[#34d399] flex items-center justify-center shadow-md shadow-emerald-500/20 text-[#041a10]">
          <svg className="w-4 h-4 text-[#041a10] stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v18m-9-9h18M5.5 5.5l13 13m0-13l-13 13" />
          </svg>
        </div>
        <div className="leading-tight">
          <div className="font-bold text-[13.5px] tracking-tight text-white">Rankwatch Ad</div>
          <div className="text-[11px] text-[#94a3b8] font-normal">Research tool</div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="p-4 flex-1 space-y-1">
        <div className="px-3 py-2 text-[10px] font-bold text-[#64748b] uppercase tracking-wider">
          Navigation
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else {
                  onSelectTab(item.id);
                }
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                isActive
                  ? 'bg-[#0e261a] text-[#2fe593] border border-[#184530] font-bold shadow-sm'
                  : 'text-[#94a3b8] hover:text-white hover:bg-[#13151a]'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <Icon className={`w-4 h-4 ${isActive ? 'text-[#2fe593]' : 'text-[#64748b]'}`} />
                <span>{item.label}</span>
              </div>
              {item.count !== undefined && (
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded-md ${
                    isActive ? 'bg-[#0a0b0e] text-[#2fe593] font-bold' : 'bg-[#13151a] text-[#94a3b8]'
                  }`}
                >
                  {item.count.toLocaleString()}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Database Connection & Sync Status Footer */}
      <div className="p-4 border-t border-[#222630] bg-[#07080a] space-y-3">
        {/* Cloud Shared DB Status Badge */}
        <div
          onClick={onOpenDataSources}
          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-colors ${
            isCloudConnected
              ? 'bg-[#0e261a]/60 border-[#184530] text-[#2fe593]'
              : 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/15'
          }`}
          title={
            isCloudConnected
              ? 'Supabase shared database is connected'
              : 'Click to configure Supabase for team sharing'
          }
        >
          <div className="flex items-center gap-2 truncate">
            {isCloudConnected ? (
              <Cloud className="w-3.5 h-3.5 flex-shrink-0" />
            ) : (
              <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0" />
            )}
            <span className="text-[11px] font-semibold truncate">
              {isCloudConnected ? 'Shared Supabase DB' : 'Local Storage Mode'}
            </span>
          </div>
          <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-black/40">
            {isCloudConnected ? 'Cloud' : 'Local'}
          </span>
        </div>

        {/* Sync Summary Card */}
        <div className="bg-[#0f1115] rounded-2xl p-3.5 border border-[#222630] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-white flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full ${
                    syncStatus?.isSyncing ? 'bg-amber-400' : 'bg-[#10b981]'
                  } opacity-75`}
                ></span>
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    syncStatus?.isSyncing ? 'bg-amber-500' : 'bg-[#10b981]'
                  }`}
                ></span>
              </span>
              Google Sheet Live
            </span>
            <span className="text-[10px] font-mono text-[#94a3b8]">{totalAds.toLocaleString()} ads</span>
          </div>

          <div className="text-[11px] text-[#94a3b8] flex items-center justify-between">
            <span>Last Synced</span>
            <span className="text-[#cbd5e1] font-mono text-[10px]">
              {(() => {
                if (!syncStatus?.lastSyncedAt) return 'Just now';
                if (
                  syncStatus.lastSyncedAt.startsWith('Today') ||
                  syncStatus.lastSyncedAt.startsWith('Live')
                ) {
                  return syncStatus.lastSyncedAt;
                }
                const d = new Date(syncStatus.lastSyncedAt);
                return isNaN(d.getTime())
                  ? syncStatus.lastSyncedAt
                  : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              })()}
            </span>
          </div>

          <button
            onClick={onOpenDataSources}
            className="w-full mt-1.5 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-[#13151a] hover:bg-[#181b21] text-xs text-[#cbd5e1] hover:text-white font-medium transition-colors border border-[#222630]"
          >
            <Database className="w-3.5 h-3.5 text-[#2fe593]" />
            <span>Manage Sources</span>
          </button>
        </div>
      </div>
    </aside>
  );
};
