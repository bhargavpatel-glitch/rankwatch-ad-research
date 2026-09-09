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
import { CanonicalAd, SearchResponse, SearchResultItem, AggregatedFilters, FilterState, SyncStatus } from './types';
import { Compass, ArrowRight } from 'lucide-react';
import {
  loadPreloadedAds,
  getClientFilters,
  searchClientAds,
  loadClientSavedGroups,
  saveClientSavedGroups
} from './utils/clientSearch';

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

  // Grouping & Saving state (persisted locally and synced with backend if online)
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

  // Debounce search input (180ms)
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

  // Fetch dynamic filters, sync status, and groups on mount
  useEffect(() => {
    fetchFilters();
    fetchSyncStatus();
    fetchGroups();

    const interval = setInterval(fetchSyncStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const fetchFilters = async () => {
    try {
      const res = await fetch('/api/filters');
      if (res.ok) {
        const data = await res.json();
        setFiltersData(data);
        return;
      }
    } catch (err) {
      // Backend not running (e.g. Netlify static hosting)
    }
    const ads = await loadPreloadedAds();
    setFiltersData(getClientFilters(ads));
  };

  const fetchSyncStatus = async () => {
    try {
      const res = await fetch('/api/sync/status');
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data);
        return;
      }
    } catch (err) {
      // Backend not running (Netlify static hosting)
    }
    setSyncStatus({
      isSyncing: false,
      currentStage: 'Idle (Preloaded)',
      progressPercent: 100,
      lastSyncedAt: 'Live Preloaded',
      recordsCount: 8280,
      newAdsCount: 0,
      updatedAdsCount: 0,
      unchangedAdsCount: 8280,
      deletedAdsCount: 0
    });
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/groups');
      if (res.ok) {
        const data = await res.json();
        if (data.groups && data.groups.length > 0) {
          setGroups(data.groups);
          return;
        }
      }
    } catch (err) {
      // Netlify static fallback
    }
    setGroups(loadClientSavedGroups());
  };

  // Execute search request (works with backend API and falls back to instant client-side search on Netlify)
  const executeSearch = useCallback(async (isLoadMore = false) => {
    setIsLoading(true);
    try {
      let data: SearchResponse | null = null;
      try {
        const params = new URLSearchParams();
        if (debouncedQuery) params.append('q', debouncedQuery);
        if (filterState.brands.length > 0) params.append('brands', filterState.brands.join(','));
        if (filterState.platforms.length > 0) params.append('platforms', filterState.platforms.join(','));
        if (filterState.creativeTypes.length > 0) params.append('creativeTypes', filterState.creativeTypes.join(','));
        if (filterState.categories.length > 0) params.append('categories', filterState.categories.join(','));
        if (filterState.sort) params.append('sort', filterState.sort);
        params.append('page', String(isLoadMore ? filterState.page + 1 : filterState.page));
        params.append('limit', String(filterState.limit));

        const res = await fetch(`/api/ads/search?${params.toString()}`);
        if (res.ok) {
          const parsed = await res.json();
          if (parsed && Array.isArray(parsed.results)) {
            data = parsed;
          }
        }
      } catch (backendErr) {
        // Backend offline or on static Netlify host
      }

      // If backend was not reachable or returned invalid/HTML response, use instant client-side search!
      if (!data || !data.results) {
        const ads = await loadPreloadedAds();
        data = searchClientAds(
          ads,
          debouncedQuery,
          filterState,
          isLoadMore ? filterState.page + 1 : 1,
          filterState.limit
        );
      }

      // Update map of ads for quick lookup
      setAllAdsMap(prev => {
        const next = new Map(prev);
        for (const item of data!.results) {
          next.set(item.ad.id, item.ad);
        }
        return next;
      });

      if (isLoadMore && searchResponse) {
        setSearchResponse({
          ...data,
          results: [...searchResponse.results, ...data.results]
        });
        setFilterState(prev => ({ ...prev, page: prev.page + 1 }));
      } else {
        setSearchResponse(data);
      }
    } catch (err) {
      console.error('Search request error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [debouncedQuery, filterState, searchResponse]);

  useEffect(() => {
    executeSearch(false);
  }, [debouncedQuery, filterState.brands, filterState.platforms, filterState.creativeTypes, filterState.categories, filterState.sort]);

  const handleFilterChange = (updates: Partial<FilterState>) => {
    setFilterState(prev => ({ ...prev, ...updates }));
  };

  const handleTriggerSync = (sheetId?: string) => {
    fetch('/api/sync/trigger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sheetId })
    })
      .then((res) => res.json())
      .then(() => {
        fetchSyncStatus();
        setTimeout(fetchFilters, 3000);
        setTimeout(executeSearch, 3500);
      })
      .catch((err) => console.error('Sync trigger error:', err));
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
      // Deselect visible
      setSelectedAdIds(prev => {
        const next = new Set(prev);
        visibleAdIds.forEach(id => next.delete(id));
        return next;
      });
    } else {
      // Select all visible
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
      try {
        await fetch(`/api/groups/liked/ads/${adId}`, { method: 'DELETE' });
      } catch (e) {}
      setGroups(prev => prev.map(g => g.id === 'liked' ? { ...g, adIds: g.adIds.filter(id => id !== adId) } : g));
      showToast('Removed from liked videos');
    } else {
      try {
        await fetch('/api/groups/liked/ads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adIds: [adId] })
        });
      } catch (e) {}
      setGroups(prev => prev.map(g => g.id === 'liked' ? { ...g, adIds: [...new Set([...g.adIds, adId])] } : g));
      showToast('Added to liked videos', 'Liked videos', () => {
        setCurrentTab('groups');
      });
    }
  };

  const handleSaveToGroup = async (groupId: string, adIds: string[]) => {
    try {
      const res = await fetch(`/api/groups/${groupId}/ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adIds })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.group) {
          setGroups(prev => prev.map(g => g.id === groupId ? data.group : g));
          setSelectedAdIds(new Set());
          return;
        }
      }
    } catch (e) {}
    setGroups(prev => prev.map(g => {
      if (g.id === groupId) {
        return { ...g, adIds: [...new Set([...g.adIds, ...adIds])], updatedAt: new Date().toISOString() };
      }
      return g;
    }));
    setSelectedAdIds(new Set());
  };

  const handleCreateGroup = async (name: string, adIds: string[]) => {
    try {
      const res = await fetch('/api/groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.group) {
          if (adIds.length > 0) {
            const res2 = await fetch(`/api/groups/${data.group.id}/ads`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ adIds })
            });
            if (res2.ok) {
              const data2 = await res2.json();
              setGroups(prev => [...prev, data2.group || data.group]);
              setSelectedAdIds(new Set());
              return;
            }
          }
          setGroups(prev => [...prev, data.group]);
          setSelectedAdIds(new Set());
          return;
        }
      }
    } catch (e) {}
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
    try {
      await fetch(`/api/groups/${groupId}`, { method: 'DELETE' });
    } catch (e) {}
    setGroups(prev => prev.filter(g => g.id !== groupId));
  };

  const handleRemoveAdFromGroup = async (groupId: string, adId: string) => {
    try {
      await fetch(`/api/groups/${groupId}/ads/${adId}`, { method: 'DELETE' });
    } catch (e) {}
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

  const totalAdsCount = filtersData?.totalAds || 8280;
  const totalSavedCount = groups.reduce((acc, g) => acc + g.adIds.length, 0);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[#0a0b0e] text-[#f8fafc]">
      {/* Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          if (tab === 'library') {
            setFilterState(prev => ({ ...prev, brands: [], platforms: [], categories: [] }));
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
          onTriggerSync={() => handleTriggerSync()}
          suggestedQueries={searchResponse?.suggestedQueries}
        />

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
      />

      {/* Floating Toast Notification (bottom-right) */}
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
              <span className="sr-only">Dismiss</span>
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
