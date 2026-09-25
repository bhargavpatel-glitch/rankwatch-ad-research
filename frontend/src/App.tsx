import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FilterBar } from './components/FilterBar';
import { AdGrid } from './components/AdGrid';
import { AdDetailDrawer } from './components/AdDetailDrawer';
import { SearchDebugModal } from './components/SearchDebugModal';
import { DataSourcesModal } from './components/DataSourcesModal';
import { SaveToGroupModal, AdGroup } from './components/SaveToGroupModal';
import { SavedGroupsView } from './components/SavedGroupsView';
import { BulkActionBar } from './components/BulkActionBar';
import { CanonicalAd, SearchResponse, SearchResultItem, AggregatedFilters, FilterState, SyncStatus, SheetSource, SyncJob } from './types';
import { Compass, ArrowRight, CheckCircle2, AlertTriangle, X } from 'lucide-react';
import {
  loadPreloadedAds,
  setCachedAds,
  getClientFilters,
  searchClientAds,
  loadClientSavedGroups,
  saveClientSavedGroups
} from './utils/clientSearch';
import { fetchSheetSourcesFromDB } from './utils/supabaseClient';
import { executeSyncWorkflow } from './utils/syncEngine';

export default function App() {
  const [currentTab, setCurrentTab] = useState('library');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [filtersData, setFiltersData] = useState<AggregatedFilters | null>(null);
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedAdItem, setSelectedAdItem] = useState<SearchResultItem | null>(null);
  const [debugMode, setDebugMode] = useState(false);
  const [isDebugModalOpen, setIsDebugModalOpen] = useState(false);
  const [isDataSourcesOpen, setIsDataSourcesOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [sources, setSources] = useState<SheetSource[]>([]);
  const [completedJob, setCompletedJob] = useState<SyncJob | null>(null);

  // Grouping & Saving state
  const [groups, setGroups] = useState<AdGroup[]>(() => loadClientSavedGroups());

  useEffect(() => {
    if (groups && groups.length > 0) {
      saveClientSavedGroups(groups);
    }
  }, [groups]);

  const [selectedAdIds, setSelectedAdIds] = useState<Set<string>>(new Set());
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [modalTargetAdIds, setModalTargetAdIds] = useState<string[]>([]);
  const [allAdsMap, setAllAdsMap] = useState<Map<string, CanonicalAd>>(new Map());

  const [filterState, setFilterState] = useState<FilterState>({
    q: '',
    brands: [],
    platforms: [],
    creativeTypes: [],
    categories: [],
    topics: [],
    hashtags: [],
    sources: [],
    tabs: [],
    sort: 'relevant',
    page: 1,
    limit: 40,
    minConfidence: 'all'
  });

  // Notification toast state
  const [toast, setToast] = useState<{
    id: number;
    message: string;
    linkText?: string;
    onLinkClick?: () => void;
  } | null>(null);

  const showToast = (message: string, linkText?: string, onLinkClick?: () => void) => {
    const id = Date.now();
    setToast({ id, message, linkText, onLinkClick });
    setTimeout(() => {
      setToast(prev => (prev?.id === id ? null : prev));
    }, 4500);
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 180);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Listen to custom suggest event
  useEffect(() => {
    const handleSuggest = (e: any) => {
      if (e.detail) {
        setSearchQuery(e.detail);
        setDebouncedQuery(e.detail);
        setCurrentTab('library');
      }
    };
    window.addEventListener('search:suggest', handleSuggest);
    return () => window.removeEventListener('search:suggest', handleSuggest);
  }, []);

  // Fetch initial data on mount
  useEffect(() => {
    initApp();
  }, []);

  const initApp = async () => {
    setIsLoading(true);
    try {
      const srcList = await fetchSheetSourcesFromDB();
      setSources(srcList);
      const ads = await loadPreloadedAds();
      setFiltersData(getClientFilters(ads));
      setSyncStatus({
        isSyncing: false,
        currentStage: 'Idle',
        progressPercent: 100,
        lastSyncedAt: 'Live Preloaded',
        recordsCount: ads.length,
        newAdsCount: 0,
        updatedAdsCount: 0,
        unchangedAdsCount: ads.length,
        deletedAdsCount: 0
      });

      // Immediately render initial results
      const initialData = searchClientAds(ads, debouncedQuery, filterState, 1, filterState.limit);
      setSearchResponse(initialData);
      setAllAdsMap(new Map(initialData.results.map(r => [r.ad.id, r.ad])));
    } catch (e) {
      console.error('App init error:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Execute search request
  const executeSearch = useCallback(async (isLoadMore = false) => {
    setIsLoading(true);
    try {
      const ads = await loadPreloadedAds();
      const data = searchClientAds(
        ads,
        debouncedQuery,
        filterState,
        isLoadMore ? filterState.page + 1 : 1,
        filterState.limit
      );

      // Update map of ads for quick lookup
      setAllAdsMap(prev => {
        const next = new Map(prev);
        for (const item of data.results) {
          next.set(item.ad.id, item.ad);
        }
        return next;
      });

      if (isLoadMore) {
        setSearchResponse(prev => prev ? ({
          ...data,
          results: [...prev.results, ...data.results]
        }) : data);
        setFilterState(prev => ({ ...prev, page: prev.page + 1 }));
      } else {
        setSearchResponse(data);
      }
    } catch (err) {
      console.error('Search request error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, filterState]);

  useEffect(() => {
    executeSearch(false);
  }, [
    debouncedQuery,
    filterState.brands,
    filterState.platforms,
    filterState.creativeTypes,
    filterState.categories,
    filterState.sources,
    filterState.tabs,
    filterState.sort
  ]);

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilterState(prev => ({ ...prev, ...updates, page: 1 }));
  };

  // Algorithm F & Algorithm H: Live Synchronization Workflow
  const handleTriggerSync = async (sheetId?: string) => {
    if (syncStatus?.isSyncing) return;

    setSyncStatus({
      isSyncing: true,
      currentStage: 'Starting sync workflow...',
      progressPercent: 10,
      lastSyncedAt: 'Syncing...',
      recordsCount: 0,
      newAdsCount: 0,
      updatedAdsCount: 0,
      unchangedAdsCount: 0,
      deletedAdsCount: 0,
    });

    try {
      let currentSources = sources.length > 0 ? sources : await fetchSheetSourcesFromDB();
      if (sheetId) {
        currentSources = currentSources.filter(
          (s) => s.spreadsheetId === sheetId || s.id === sheetId
        );
      }
      const existingAds = await loadPreloadedAds();

      const { job, updatedAds } = await executeSyncWorkflow({
        sources: currentSources,
        existingAds,
        onProgress: (progressJob) => {
          setSyncStatus({
            isSyncing: progressJob.status === 'running',
            currentStage: progressJob.currentStage || 'Processing rows...',
            progressPercent: progressJob.progressPercent,
            lastSyncedAt: 'Syncing...',
            recordsCount: progressJob.resultCounts.rowsExamined,
            newAdsCount: progressJob.resultCounts.newAdsCount,
            updatedAdsCount: progressJob.resultCounts.updatedAdsCount,
            unchangedAdsCount: progressJob.resultCounts.unchangedAdsCount,
            deletedAdsCount: 0,
            lastJob: progressJob,
          });
        },
      });

      // Update in-memory cached ads
      setCachedAds(updatedAds);
      setFiltersData(getClientFilters(updatedAds));
      await executeSearch(false);

      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setSyncStatus({
        isSyncing: false,
        currentStage: 'Completed',
        progressPercent: 100,
        lastSyncedAt: `Today at ${nowStr}`,
        recordsCount: updatedAds.length,
        newAdsCount: job.resultCounts.newAdsCount,
        updatedAdsCount: job.resultCounts.updatedAdsCount,
        unchangedAdsCount: job.resultCounts.unchangedAdsCount,
        deletedAdsCount: 0,
        lastJob: job,
      });

      // Show completion notification modal
      setCompletedJob(job);
    } catch (err: any) {
      console.error('Sync failed:', err);
      setSyncStatus({
        isSyncing: false,
        currentStage: 'Error',
        progressPercent: 0,
        lastSyncedAt: 'Failed',
        recordsCount: 0,
        newAdsCount: 0,
        updatedAdsCount: 0,
        unchangedAdsCount: 0,
        deletedAdsCount: 0,
        error: err.message || 'Sync failed',
      });
      showToast(`Sync Error: ${err.message || 'Failed to sync'}`);
    }
  };

  // Grouping & Saving Handlers
  const likedAdIds = new Set(groups.find(g => g.id === 'liked')?.adIds || []);
  const savedAdIds = new Set(groups.filter(g => g.id !== 'liked').flatMap(g => g.adIds));

  const visibleResults = searchResponse?.results || [];
  const visibleAdIds = visibleResults.map(r => r.ad.id);
  const isAllSelected = visibleAdIds.length > 0 && visibleAdIds.every(id => selectedAdIds.has(id));
  const isSomeSelected = visibleAdIds.some(id => selectedAdIds.has(id)) && !isAllSelected;

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedAdIds(prev => {
        const next = new Set(prev);
        visibleAdIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      setSelectedAdIds(prev => {
        const next = new Set(prev);
        visibleAdIds.forEach(id => next.add(id));
        return next;
      });
    }
  };

  const handleToggleSelect = (adId: string) => {
    setSelectedAdIds(prev => {
      const next = new Set(prev);
      if (next.has(adId)) {
        next.delete(adId);
      } else {
        next.add(adId);
      }
      return next;
    });
  };

  const handleToggleLike = async (adId: string) => {
    const isCurrentlyLiked = likedAdIds.has(adId);
    if (isCurrentlyLiked) {
      setGroups(prev => prev.map(g => g.id === 'liked' ? { ...g, adIds: g.adIds.filter(id => id !== adId) } : g));
      showToast('Removed from liked videos');
    } else {
      setGroups(prev => prev.map(g => g.id === 'liked' ? { ...g, adIds: [...new Set([...g.adIds, adId])] } : g));
      showToast('Added to liked videos', 'Liked videos', () => {
        setCurrentTab('groups');
      });
    }
  };

  const handleSaveToGroup = async (groupId: string, adIds: string[]) => {
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, adIds: [...new Set([...g.adIds, ...adIds])], updatedAt: new Date().toISOString() };
      }
      return g;
    }));
    setSelectedAdIds(new Set());
  };

  const handleCreateGroup = async (name: string, adIds: string[]) => {
    const newGroup: AdGroup = {
      id: 'grp_' + Date.now().toString(36),
      name,
      adIds: [...adIds],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setGroups(prev => [...prev, newGroup]);
    setSelectedAdIds(new Set());
  };

  const handleDeleteGroup = async (groupId: string) => {
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleRemoveAdFromGroup = async (groupId: string, adId: string) => {
    setGroups(prev => prev.map(g => g.id === groupId ? { ...g, adIds: g.adIds.filter(id => id !== adId) } : g));
  };

  const openSaveModalForAds = (adIds: string[]) => {
    setModalTargetAdIds(adIds);
    setSaveModalOpen(true);
  };

  const handleSelectSimilar = (simAd: CanonicalAd) => {
    setSelectedAdItem({
      ad: simAd,
      score: 1.0,
      confidence: 'high',
      explanation: {
        matchedFields: ['similar'],
        exactMatch: false,
        brandMatch: false,
        scoreBreakdown: {
          exactScore: 0,
          brandScore: 0,
          phraseScore: 0,
          fieldScore: 0,
          semanticScore: 1.0,
          featureScore: 0,
          categoryScore: 0,
          platformScore: 0,
          total: 1.0
        },
        highlightTerms: [],
        explanationNote: 'Recommended based on shared concepts & brand taxonomy.'
      }
    });
  };

  const totalAdsCount = filtersData?.totalAds || 7265;
  const totalSavedCount = groups.reduce((acc, g) => acc + g.adIds.length, 0);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0b0e] text-[#f8fafc]">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'library') {
            setFilterState(prev => ({ ...prev, brands: [], platforms: [], categories: [], sources: [], tabs: [] }));
          }
        }}
        syncStatus={syncStatus}
        totalAds={totalAdsCount}
        savedAdsCount={totalSavedCount}
        onOpenDataSources={() => setIsDataSourcesOpen(true)}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#0a0b0e]">
        {/* Top Header */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={(q) => {
            setDebouncedQuery(q);
            setCurrentTab('library');
          }}
          debugMode={debugMode}
          onToggleDebug={() => {
            setDebugMode(prev => !prev);
            if (!debugMode) setIsDebugModalOpen(true);
          }}
          syncStatus={syncStatus}
          onTriggerSync={handleTriggerSync}
          suggestedQueries={searchResponse?.suggestedQueries}
        />

        {/* Live Syncing Progress Banner */}
        {syncStatus?.isSyncing && (
          <div className="bg-[#0e261a] border-b border-[#2fe593]/40 px-6 py-2.5 flex items-center justify-between text-xs animate-in fade-in duration-150 select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-2.5 h-2.5 rounded-full bg-[#2fe593] animate-ping" />
              <span className="font-semibold text-white">Syncing Google Sheets:</span>
              <span className="text-[#2fe593]">{syncStatus.currentStage}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-36 h-1.5 rounded-full bg-[#0a0b0e] overflow-hidden border border-[#184530]">
                <div
                  className="h-full bg-[#2fe593] transition-all duration-200"
                  style={{ width: `${syncStatus.progressPercent}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-[#2fe593]">{syncStatus.progressPercent}%</span>
            </div>
          </div>
        )}

        {/* Tab 1: Ad Library (Main Discovery Grid) */}
        {currentTab === 'library' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Filter Bar */}
            <FilterBar
              filters={filtersData}
              state={filterState}
              onChange={handleFilterChange}
              totalResults={searchResponse?.totalResults || 0}
              tookMs={searchResponse?.tookMs}
              isSearching={isLoading}
              isAllSelected={isAllSelected}
              isSomeSelected={isSomeSelected}
              selectedCount={selectedAdIds.size}
              onToggleSelectAll={handleToggleSelectAll}
            />

            {/* Scrollable Ad Grid Container */}
            <div className="flex-1 overflow-y-auto">
              <AdGrid
                items={searchResponse?.results || []}
                isLoading={isLoading}
                onSelectAd={setSelectedAdItem}
                debugMode={debugMode}
                selectedAdIds={selectedAdIds}
                onToggleSelect={handleToggleSelect}
                likedAdIds={likedAdIds}
                onToggleLike={handleToggleLike}
                savedAdIds={savedAdIds}
                onOpenSaveToGroup={(adId) => openSaveModalForAds([adId])}
                onResetFilters={() => {
                  setSearchQuery('');
                  setDebouncedQuery('');
                  setFilterState({
                    q: '',
                    brands: [],
                    platforms: [],
                    creativeTypes: [],
                    categories: [],
                    topics: [],
                    hashtags: [],
                    sources: [],
                    tabs: [],
                    sort: 'relevant',
                    page: 1,
                    limit: 40,
                    minConfidence: 'all'
                  });
                }}
                totalResults={searchResponse?.totalResults || 0}
                onLoadMore={() => executeSearch(true)}
                hasMore={(searchResponse?.results.length || 0) < (searchResponse?.totalResults || 0)}
              />
            </div>
          </div>
        )}

        {/* Tab 2: Explore Concepts */}
        {currentTab === 'explore' && (
          <div className="flex-1 overflow-y-auto p-8 space-y-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#2fe593]" />
                <span>Explore Ad Concepts & Themes</span>
              </h2>
              <p className="text-xs text-[#94a3b8] mt-1">
                Discover advertisements grouped by marketing angles, AI features, and campaign objectives.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[
                { title: 'Answer Engine Optimization (AEO)', query: 'AEO', desc: 'Tracking and visibility across ChatGPT, Perplexity, Gemini, and Claude.', count: '450+ ads' },
                { title: 'Generative Engine Optimization (GEO)', query: 'GEO', desc: 'Enterprise AI search optimization and synthetic authority campaigns.', count: '1,200+ ads' },
                { title: 'Autonomous AI Marketer', query: 'Autonomous AI', desc: 'Background agents transforming prompt data into marketing execution.', count: '180+ ads' },
                { title: 'Enterprise GTM Case Studies', query: 'MongoDB Case Study', desc: 'High-converting social proof, customer stories, and ROI metrics.', count: '90+ ads' },
                { title: 'Document & Carousel Ads', query: 'Document Ad', desc: 'Multi-slide LinkedIn playbooks, PDF frameworks, and whitepapers.', count: '1,500+ ads' },
                { title: 'Short-Form Reels & Video Hooks', query: 'Instagram tagged', desc: 'High-retention social hooks, video teardowns, and creator videos.', count: '812 ads' },
              ].map((c, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setSearchQuery(c.query);
                    setDebouncedQuery(c.query);
                    setCurrentTab('library');
                  }}
                  className="p-5 rounded-2xl bg-[#13151a] border border-[#222630] hover:border-[#2fe593]/40 hover:shadow-xl transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white group-hover:text-[#2fe593] transition-colors">
                      {c.title}
                    </span>
                    <span className="text-[10px] font-mono text-[#64748b]">{c.count}</span>
                  </div>
                  <p className="text-xs text-[#94a3b8] leading-relaxed">{c.desc}</p>
                  <div className="pt-2 flex items-center gap-1 text-[11px] text-[#2fe593] font-semibold">
                    <span>Search Concept</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Saved Groups & Collections */}
        {currentTab === 'groups' && (
          <SavedGroupsView
            groups={groups}
            allAdsMap={allAdsMap}
            onSelectAd={setSelectedAdItem}
            onCreateGroup={handleCreateGroup}
            onDeleteGroup={handleDeleteGroup}
            onRemoveAdFromGroup={handleRemoveAdFromGroup}
            debugMode={debugMode}
          />
        )}
      </main>

      {/* Floating Bulk Action Bar when ads are selected */}
      <BulkActionBar
        selectedCount={selectedAdIds.size}
        onSaveToLiked={() => {
          handleSaveToGroup('liked', Array.from(selectedAdIds));
        }}
        onOpenSaveToGroup={() => {
          openSaveModalForAds(Array.from(selectedAdIds));
        }}
        onClearSelection={() => setSelectedAdIds(new Set())}
      />

      {/* Save to Group Modal */}
      <SaveToGroupModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        selectedAdIds={modalTargetAdIds}
        groups={groups}
        onSaveToGroup={handleSaveToGroup}
        onCreateGroup={handleCreateGroup}
      />

      {/* Slide-over Ad Detail Drawer */}
      <AdDetailDrawer
        item={selectedAdItem}
        onClose={() => setSelectedAdItem(null)}
        onSelectSimilar={handleSelectSimilar}
      />

      {/* Developer Search Relevance Inspector Modal */}
      <SearchDebugModal
        isOpen={isDebugModalOpen}
        onClose={() => setIsDebugModalOpen(false)}
        searchResponse={searchResponse}
      />

      {/* Data Sources & Sync Management Modal */}
      <DataSourcesModal
        isOpen={isDataSourcesOpen}
        onClose={() => setIsDataSourcesOpen(false)}
        syncStatus={syncStatus}
        onTriggerSync={handleTriggerSync}
        onSourcesUpdated={(newSources) => setSources(newSources)}
      />

      {/* Algorithm H: Sync Completion Notification Modal */}
      {completedJob && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150 select-none">
          <div className="w-full max-w-md bg-[#0f1115] border border-[#2fe593]/50 rounded-2xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#0e261a] border border-[#184530] flex items-center justify-center text-[#2fe593]">
                  <CheckCircle2 className="w-6 h-6 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider">Sync Completed</h3>
                  <span className="text-[11px] text-[#94a3b8] font-mono">Job: {completedJob.id}</span>
                </div>
              </div>
              <button
                onClick={() => setCompletedJob(null)}
                className="p-1 rounded-lg bg-[#13151a] hover:bg-[#181b21] text-[#94a3b8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Algorithm H Report Cards */}
            <div className="space-y-3 bg-[#0a0b0e] p-4 rounded-xl border border-[#222630]">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-[#13151a] p-2 rounded-lg border border-[#222630]">
                  <span className="text-[10px] text-[#64748b] block">Sources</span>
                  <span className="text-sm font-bold text-white font-mono">{completedJob.resultCounts.sourcesScanned}</span>
                </div>
                <div className="bg-[#13151a] p-2 rounded-lg border border-[#222630]">
                  <span className="text-[10px] text-[#64748b] block">Tabs</span>
                  <span className="text-sm font-bold text-white font-mono">{completedJob.resultCounts.tabsScanned}</span>
                </div>
                <div className="bg-[#13151a] p-2 rounded-lg border border-[#222630]">
                  <span className="text-[10px] text-[#64748b] block">Rows</span>
                  <span className="text-sm font-bold text-white font-mono">{completedJob.resultCounts.rowsExamined}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 text-xs">
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#13151a]">
                  <span className="text-[#94a3b8]">New Ads Added:</span>
                  <span className="font-bold text-[#2fe593] font-mono">{completedJob.resultCounts.newAdsCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#13151a]">
                  <span className="text-[#94a3b8]">Ads Updated:</span>
                  <span className="font-bold text-amber-400 font-mono">{completedJob.resultCounts.updatedAdsCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#13151a]">
                  <span className="text-[#94a3b8]">Unchanged:</span>
                  <span className="font-bold text-[#cbd5e1] font-mono">{completedJob.resultCounts.unchangedAdsCount}</span>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-[#13151a]">
                  <span className="text-[#94a3b8]">Rows Skipped:</span>
                  <span className="font-bold text-[#64748b] font-mono">{completedJob.resultCounts.skippedRowsCount}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setCompletedJob(null)}
              className="w-full py-2.5 rounded-xl bg-[#2fe593] hover:bg-[#28d384] text-[#031a0f] font-bold text-xs shadow-lg shadow-[#2fe593]/20 transition-all"
            >
              Continue to Ad Library
            </button>
          </div>
        </div>
      )}

      {/* Floating Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#0f1115]/95 border border-[#222630] shadow-2xl backdrop-blur-md text-white text-xs font-medium">
            <div className="w-5 h-5 rounded-full bg-[#0e261a] border border-[#2fe593]/40 flex items-center justify-center flex-shrink-0">
              <span className="w-2 h-2 rounded-full bg-[#2fe593]"></span>
            </div>
            <span className="text-[#f8fafc]">{toast.message}</span>
            {toast.linkText && (
              <button
                onClick={() => {
                  toast.onLinkClick?.();
                  setToast(null);
                }}
                className="text-[#2fe593] hover:text-[#5df0ab] font-bold underline underline-offset-2 ml-1 cursor-pointer transition-colors"
              >
                {toast.linkText}
              </button>
            )}
            <button
              onClick={() => setToast(null)}
              className="p-1 rounded-md text-[#64748b] hover:text-white hover:bg-[#181b21] transition-colors ml-1"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
