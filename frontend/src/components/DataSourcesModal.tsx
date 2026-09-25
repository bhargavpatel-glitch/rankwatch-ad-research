import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Database,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Layers,
  Check,
  History,
  Trash2,
  Edit2,
} from 'lucide-react';
import { SheetSource, SheetTabConfig, SyncJob, SyncStatus } from '../types';
import { discoverGoogleSheetTabs, TabDiscoveryResult } from '../utils/syncEngine';
import { fetchSheetSourcesFromDB, fetchSyncHistory, saveSheetSourcesToDB } from '../utils/supabaseClient';
import { detectFieldMappings } from '../utils/columnDetector';

interface DataSourcesModalProps {
  isOpen: boolean;
  onClose: () => void;
  syncStatus: SyncStatus | null;
  onTriggerSync: (sheetId?: string) => void;
  onSourcesUpdated?: (sources: SheetSource[]) => void;
}

const DEFAULT_PLATFORMS = [
  'linkedin',
  'instagram',
  'meta',
  'google',
  'tiktok',
  'youtube',
  'twitter',
  'pinterest',
  'reddit',
  'quora',
];

export const DataSourcesModal: React.FC<DataSourcesModalProps> = ({
  isOpen,
  onClose,
  syncStatus,
  onTriggerSync,
  onSourcesUpdated,
}) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'history'>('sources');
  const [sources, setSources] = useState<SheetSource[]>([]);
  const [history, setHistory] = useState<SyncJob[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [sheetUrl, setSheetUrl] = useState('');
  const [sheetName, setSheetName] = useState('');
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [discoveryResult, setDiscoveryResult] = useState<TabDiscoveryResult | null>(null);
  const [selectedTabs, setSelectedTabs] = useState<Record<string, boolean>>({});
  const [tabPlatforms, setTabPlatforms] = useState<Record<string, string>>({});
  const [customPlatforms, setCustomPlatforms] = useState<string[]>([]);
  const [newTabInput, setNewTabInput] = useState('');
  const [isAddingManualTab, setIsAddingManualTab] = useState(false);
  const [newCustomPlatformInput, setNewCustomPlatformInput] = useState('');
  const [activeCustomPlatformTabId, setActiveCustomPlatformTabId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    loadData();
  }, [isOpen]);

  const loadData = async () => {
    try {
      const srcList = await fetchSheetSourcesFromDB();
      setSources(srcList);
      onSourcesUpdated?.(srcList);
      const histList = await fetchSyncHistory();
      setHistory(histList);
    } catch (e) {
      console.error('Failed to load sources & history:', e);
    }
  };

  // Algorithm A.1 & A.2: Step 1 -> Discover Tabs
  const handleDiscoverTabs = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sheetUrl.trim()) return;

    setErrorMsg(null);
    setIsDiscovering(true);

    try {
      const result = await discoverGoogleSheetTabs(sheetUrl.trim());
      setDiscoveryResult(result);

      // Pre-select all discovered tabs by default
      const initialSelected: Record<string, boolean> = {};
      const initialPlatforms: Record<string, string> = {};

      result.tabs.forEach((t) => {
        initialSelected[t.sheetId] = true;
        initialPlatforms[t.sheetId] = t.suggestedPlatform || 'google';
      });

      setSelectedTabs(initialSelected);
      setTabPlatforms(initialPlatforms);
      setIsDiscovering(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to discover tabs. Ensure sheet is shared as "Anyone with link can view".');
      setIsDiscovering(false);
    }
  };

  const handleAddManualTab = () => {
    if (!newTabInput.trim() || !discoveryResult) return;
    const tabName = newTabInput.trim();
    const sheetId = `custom_${Date.now()}`;

    setDiscoveryResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tabs: [
          ...prev.tabs,
          {
            sheetId,
            title: tabName,
            suggestedPlatform: 'google',
            confidence: 1.0,
            headers: [],
            sampleRows: [],
          },
        ],
      };
    });

    setSelectedTabs((prev) => ({ ...prev, [sheetId]: true }));
    setTabPlatforms((prev) => ({ ...prev, [sheetId]: 'google' }));
    setNewTabInput('');
    setIsAddingManualTab(false);
  };

  const handleRemoveTab = (sheetId: string) => {
    if (!discoveryResult) return;
    setDiscoveryResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        tabs: prev.tabs.filter((t) => t.sheetId !== sheetId),
      };
    });
  };

  const handleAddNewCustomPlatform = (tabId: string) => {
    if (!newCustomPlatformInput.trim()) return;
    const cleanPlatform = newCustomPlatformInput.trim().toLowerCase();
    if (!customPlatforms.includes(cleanPlatform) && !DEFAULT_PLATFORMS.includes(cleanPlatform)) {
      setCustomPlatforms((prev) => [...prev, cleanPlatform]);
    }
    setTabPlatforms((prev) => ({ ...prev, [tabId]: cleanPlatform }));
    setNewCustomPlatformInput('');
    setActiveCustomPlatformTabId(null);
  };

  // Algorithm A.5: Save Discovered & Selected Tabs
  const handleSaveSource = async () => {
    if (!discoveryResult) return;

    const spreadsheetId = discoveryResult.spreadsheetId;
    const sourceId = `src_${Date.now()}`;
    const configuredTabs: SheetTabConfig[] = discoveryResult.tabs.map((t) => {
      const isSelected = selectedTabs[t.sheetId] ?? true;
      const headers = t.headers || [];
      const { mappings, confidence } = detectFieldMappings(headers);

      return {
        id: `tab_${t.sheetId}`,
        sourceId,
        tabId: t.sheetId,
        tabName: t.title,
        selected: isSelected,
        platform: tabPlatforms[t.sheetId] || t.suggestedPlatform || 'google',
        fieldMapping: mappings,
        mappingConfidence: confidence.company ? 1.0 : 0.8,
      };
    });

    const newSource: SheetSource = {
      id: sourceId,
      spreadsheetId,
      spreadsheetUrl: sheetUrl.trim(),
      sourceName: sheetName.trim() || `Spreadsheet ${spreadsheetId.slice(0, 8)}`,
      active: true,
      status: 'active',
      tabs: configuredTabs,
      recordCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const updatedSources = [...sources, newSource];
    setSources(updatedSources);
    await saveSheetSourcesToDB(updatedSources);
    onSourcesUpdated?.(updatedSources);

    // Reset adding state
    setIsAdding(false);
    setDiscoveryResult(null);
    setSheetUrl('');
    setSheetName('');

    // Trigger sync for the newly added source
    onTriggerSync(spreadsheetId);
  };

  const handleToggleTabSelect = (tabId: string) => {
    setSelectedTabs((prev) => ({
      ...prev,
      [tabId]: !prev[tabId],
    }));
  };

  const handleSelectAllTabs = (select: boolean) => {
    if (!discoveryResult) return;
    const next: Record<string, boolean> = {};
    discoveryResult.tabs.forEach((t) => {
      next[t.sheetId] = select;
    });
    setSelectedTabs(next);
  };

  const handleDeleteSource = async (sourceId: string) => {
    const updated = sources.filter((s) => s.id !== sourceId);
    setSources(updated);
    await saveSheetSourcesToDB(updated);
    onSourcesUpdated?.(updated);
  };

  const allAvailablePlatforms = Array.from(new Set([...DEFAULT_PLATFORMS, ...customPlatforms]));

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
      <div className="w-full max-w-3xl bg-[#0f1115] border border-[#222630] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="h-16 px-6 border-b border-[#222630] flex items-center justify-between bg-[#0a0b0e]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#0e261a] border border-[#184530] flex items-center justify-center text-[#2fe593]">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-white">Google Sheets Data Management</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#181b21] text-[#94a3b8] border border-[#222630]">
                  Multi-Source Sync
                </span>
              </div>
              <p className="text-[11px] text-[#94a3b8]">Configure spreadsheets, discovered tabs, and sync history</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center bg-[#13151a] p-1 rounded-xl border border-[#222630]">
              <button
                onClick={() => setActiveTab('sources')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'sources'
                    ? 'bg-[#0e261a] text-[#2fe593] border border-[#184530]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                Sources ({sources.length})
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  activeTab === 'history'
                    ? 'bg-[#0e261a] text-[#2fe593] border border-[#184530]'
                    : 'text-[#94a3b8] hover:text-white'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Sync History</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#13151a] hover:bg-[#181b21] text-[#94a3b8] hover:text-white transition-colors border border-[#222630]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {activeTab === 'sources' && (
            <>
              {/* Active Sources List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">
                    Configured Google Sheets ({sources.length})
                  </span>
                  {!isAdding && (
                    <button
                      onClick={() => {
                        setIsAdding(true);
                        setDiscoveryResult(null);
                        setErrorMsg(null);
                      }}
                      className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#2fe593] hover:bg-[#28d384] text-[#031a0f] text-xs font-bold shadow-md shadow-[#2fe593]/20 transition-all active:scale-95"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Add Google Sheet</span>
                    </button>
                  )}
                </div>

                {/* Add Sheet Workflow (Algorithm A) */}
                {isAdding && (
                  <div className="bg-[#0a0b0e] rounded-xl p-5 border border-[#2fe593]/40 space-y-4 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-[#2fe593]" />
                        Register Google Sheets Source (Algorithm A)
                      </span>
                      <button
                        onClick={() => {
                          setIsAdding(false);
                          setDiscoveryResult(null);
                        }}
                        className="text-[#64748b] hover:text-white"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {errorMsg && (
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}

                    {!discoveryResult ? (
                      /* Step 1: Input URL */
                      <form onSubmit={handleDiscoverTabs} className="space-y-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-[#94a3b8] mb-1">
                            Google Sheets URL or ID *
                          </label>
                          <input
                            type="text"
                            value={sheetUrl}
                            onChange={(e) => setSheetUrl(e.target.value)}
                            placeholder="https://docs.google.com/spreadsheets/d/1B_m6K3T2U7.../edit"
                            required
                            className="w-full px-3 py-2 rounded-xl bg-[#13151a] border border-[#222630] text-xs text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#2fe593]"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-[#94a3b8] mb-1">
                            Custom Source Name (Optional)
                          </label>
                          <input
                            type="text"
                            value={sheetName}
                            onChange={(e) => setSheetName(e.target.value)}
                            placeholder="e.g. Q4 Competitor Research"
                            className="w-full px-3 py-2 rounded-xl bg-[#13151a] border border-[#222630] text-xs text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#2fe593]"
                          />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                          <button
                            type="button"
                            onClick={() => setIsAdding(false)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#13151a] hover:bg-[#181b21] text-[#94a3b8] hover:text-white text-xs border border-[#222630]"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={isDiscovering}
                            className="px-4 py-1.5 rounded-xl bg-[#2fe593] hover:bg-[#28d384] text-[#031a0f] font-bold text-xs shadow-md shadow-[#2fe593]/20 flex items-center gap-1.5 transition-all disabled:opacity-50"
                          >
                            {isDiscovering && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                            <span>{isDiscovering ? 'Discovering Tabs...' : 'Discover Available Tabs'}</span>
                          </button>
                        </div>
                      </form>
                    ) : (
                      /* Step 2: Tab Selection & Platform Verification */
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between pb-2 border-b border-[#222630] gap-2">
                          <div>
                            <h4 className="text-xs font-bold text-white">Select Tabs to Scan</h4>
                            <p className="text-[11px] text-[#94a3b8]">
                              Discovered {discoveryResult.tabs.length} tab(s) in spreadsheet
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleSelectAllTabs(true)}
                              className="text-[11px] text-[#2fe593] hover:underline font-semibold"
                            >
                              Select All
                            </button>
                            <span className="text-[#384052]">•</span>
                            <button
                              type="button"
                              onClick={() => handleSelectAllTabs(false)}
                              className="text-[11px] text-[#94a3b8] hover:underline"
                            >
                              Clear All
                            </button>
                            <span className="text-[#384052]">•</span>
                            <button
                              type="button"
                              onClick={() => setIsAddingManualTab(true)}
                              className="text-[11px] text-[#2fe593] hover:underline font-semibold flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" />
                              <span>Add Tab</span>
                            </button>
                          </div>
                        </div>

                        {/* Add Manual Tab Input */}
                        {isAddingManualTab && (
                          <div className="flex items-center gap-2 bg-[#13151a] p-2.5 rounded-xl border border-[#2fe593]/40">
                            <input
                              type="text"
                              value={newTabInput}
                              onChange={(e) => setNewTabInput(e.target.value)}
                              placeholder="Enter exact sheet tab name (e.g. LinkedIn Ads, Google Ads)"
                              className="flex-1 px-2.5 py-1 rounded-lg bg-[#0a0b0e] border border-[#222630] text-xs text-white placeholder:text-[#64748b] focus:outline-none focus:border-[#2fe593]"
                            />
                            <button
                              type="button"
                              onClick={handleAddManualTab}
                              className="px-3 py-1 bg-[#2fe593] text-[#031a0f] rounded-lg text-xs font-bold"
                            >
                              Add
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsAddingManualTab(false)}
                              className="text-[#94a3b8] hover:text-white p-1"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="space-y-2 max-h-60 overflow-y-auto">
                          {discoveryResult.tabs.map((tab) => {
                            const isChecked = selectedTabs[tab.sheetId] ?? true;
                            const currentPlatform = tabPlatforms[tab.sheetId] || tab.suggestedPlatform || 'google';

                            return (
                              <div
                                key={tab.sheetId}
                                className={`p-3 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                                  isChecked
                                    ? 'bg-[#13151a] border-[#2fe593]/50'
                                    : 'bg-[#0a0b0e] border-[#222630] opacity-60'
                                }`}
                              >
                                <div className="flex items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleTabSelect(tab.sheetId)}
                                    className={`w-4 h-4 rounded-md flex items-center justify-center border transition-colors ${
                                      isChecked
                                        ? 'bg-[#10b981] border-[#10b981] text-[#031a0f]'
                                        : 'border-[#384052] bg-[#0a0b0e]'
                                    }`}
                                  >
                                    {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </button>

                                  <div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-bold text-white">{tab.title}</span>
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#0e261a] text-[#2fe593] border border-[#184530]">
                                        {Math.round(tab.confidence * 100)}% Match
                                      </span>
                                    </div>
                                    {tab.headers && tab.headers.length > 0 && (
                                      <div className="text-[10px] text-[#64748b] truncate max-w-sm mt-0.5">
                                        Columns: {tab.headers.slice(0, 5).join(', ')}...
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* Platform Selector & Custom Platform Addition */}
                                <div className="flex items-center gap-2">
                                  <label className="text-[10px] text-[#64748b]">Platform:</label>

                                  {activeCustomPlatformTabId === tab.sheetId ? (
                                    <div className="flex items-center gap-1.5">
                                      <input
                                        type="text"
                                        value={newCustomPlatformInput}
                                        onChange={(e) => setNewCustomPlatformInput(e.target.value)}
                                        placeholder="e.g. Reddit"
                                        className="w-24 bg-[#0a0b0e] border border-[#2fe593] rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleAddNewCustomPlatform(tab.sheetId)}
                                        className="px-2 py-1 bg-[#2fe593] text-[#031a0f] rounded-lg text-[10px] font-bold"
                                      >
                                        Save
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setActiveCustomPlatformTabId(null)}
                                        className="text-[#64748b] hover:text-white"
                                      >
                                        <X className="w-3 h-3" />
                                      </button>
                                    </div>
                                  ) : (
                                    <select
                                      value={currentPlatform}
                                      onChange={(e) => {
                                        if (e.target.value === '__add_custom__') {
                                          setActiveCustomPlatformTabId(tab.sheetId);
                                          setNewCustomPlatformInput('');
                                        } else {
                                          setTabPlatforms((prev) => ({
                                            ...prev,
                                            [tab.sheetId]: e.target.value,
                                          }));
                                        }
                                      }}
                                      className="bg-[#0a0b0e] border border-[#222630] rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:border-[#2fe593] capitalize"
                                    >
                                      {allAvailablePlatforms.map((p) => (
                                        <option key={p} value={p}>
                                          {p === 'meta' ? 'Meta Ads' : p.charAt(0).toUpperCase() + p.slice(1)}
                                        </option>
                                      ))}
                                      <option value="__add_custom__">+ Add Custom Platform...</option>
                                    </select>
                                  )}

                                  {/* Delete tab button */}
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTab(tab.sheetId)}
                                    className="text-[#64748b] hover:text-red-400 p-1"
                                    title="Remove tab from scan"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        <div className="flex justify-end gap-2 pt-2 border-t border-[#222630]">
                          <button
                            type="button"
                            onClick={() => setDiscoveryResult(null)}
                            className="px-3.5 py-1.5 rounded-xl bg-[#13151a] hover:bg-[#181b21] text-[#94a3b8] hover:text-white text-xs border border-[#222630]"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveSource}
                            className="px-4 py-1.5 rounded-xl bg-[#2fe593] hover:bg-[#28d384] text-[#031a0f] font-bold text-xs shadow-md shadow-[#2fe593]/20 flex items-center gap-1.5 transition-all"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Save Source & Start Sync</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Sources Card List */}
                <div className="space-y-3">
                  {sources.map((src) => (
                    <div
                      key={src.id}
                      className="bg-[#13151a] rounded-xl p-4 border border-[#222630] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{src.sourceName}</span>
                          <span
                            className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              src.active
                                ? 'bg-[#0e261a] text-[#2fe593] border border-[#184530]'
                                : 'bg-[#181b21] text-[#64748b] border border-[#222630]'
                            }`}
                          >
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            {src.active ? 'Active' : 'Paused'}
                          </span>
                        </div>

                        <a
                          href={src.spreadsheetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#94a3b8] hover:text-[#2fe593] flex items-center gap-1 transition-colors font-mono truncate max-w-md"
                        >
                          <span className="truncate">{src.spreadsheetUrl}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>

                        <div className="flex flex-wrap items-center gap-2 pt-1 text-[11px] text-[#64748b]">
                          <span>
                            Selected Tabs:{' '}
                            <b className="text-[#cbd5e1]">
                              {src.tabs.filter((t) => t.selected).map((t) => t.tabName).join(', ') || 'None'}
                            </b>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onTriggerSync(src.spreadsheetId)}
                          disabled={syncStatus?.isSyncing}
                          className="px-3.5 py-1.5 rounded-xl bg-[#0a0b0e] hover:bg-[#181b21] text-[#cbd5e1] hover:text-white border border-[#222630] text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${
                              syncStatus?.isSyncing ? 'animate-spin text-amber-400' : 'text-[#2fe593]'
                            }`}
                          />
                          <span>{syncStatus?.isSyncing ? 'Syncing...' : 'Sync Now'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteSource(src.id)}
                          className="p-1.5 rounded-lg bg-[#0a0b0e] hover:bg-red-500/20 text-[#64748b] hover:text-red-400 border border-[#222630] transition-colors"
                          title="Remove source"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'history' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-[#222630]">
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                  Sync Job History & Reports
                </h3>
                <span className="text-[11px] text-[#64748b]">Real Database Metrics</span>
              </div>

              {history.length === 0 ? (
                <div className="text-center py-10 text-xs text-[#64748b]">
                  No past sync jobs recorded yet. Click "Sync Now" to start your first sync!
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((job) => (
                    <div
                      key={job.id}
                      className="bg-[#13151a] rounded-xl p-4 border border-[#222630] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              job.status === 'completed'
                                ? 'bg-[#0e261a] text-[#2fe593] border border-[#184530]'
                                : job.status === 'completed_with_errors'
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                                : 'bg-[#181b21] text-[#94a3b8]'
                            }`}
                          >
                            {job.status.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs font-mono text-[#cbd5e1]">{job.id}</span>
                        </div>

                        <span className="text-[11px] text-[#64748b]">
                          {new Date(job.startedAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                        <div className="bg-[#0a0b0e] p-2.5 rounded-lg border border-[#222630]">
                          <span className="text-[10px] text-[#64748b] block">New Ads Added</span>
                          <span className="text-sm font-bold text-[#2fe593] font-mono">
                            {job.resultCounts?.newAdsCount || 0}
                          </span>
                        </div>
                        <div className="bg-[#0a0b0e] p-2.5 rounded-lg border border-[#222630]">
                          <span className="text-[10px] text-[#64748b] block">Ads Updated</span>
                          <span className="text-sm font-bold text-amber-400 font-mono">
                            {job.resultCounts?.updatedAdsCount || 0}
                          </span>
                        </div>
                        <div className="bg-[#0a0b0e] p-2.5 rounded-lg border border-[#222630]">
                          <span className="text-[10px] text-[#64748b] block">Unchanged</span>
                          <span className="text-sm font-bold text-[#cbd5e1] font-mono">
                            {job.resultCounts?.unchangedAdsCount || 0}
                          </span>
                        </div>
                        <div className="bg-[#0a0b0e] p-2.5 rounded-lg border border-[#222630]">
                          <span className="text-[10px] text-[#64748b] block">Rows Examined</span>
                          <span className="text-sm font-bold text-white font-mono">
                            {job.resultCounts?.rowsExamined || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
