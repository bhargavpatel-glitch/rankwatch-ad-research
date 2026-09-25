export interface CanonicalAd {
  id: string;
  sourceSheetId: string;
  sourceTab: string;
  platform: string;
  platformAdId?: string;
  normalizedAdUrl?: string;
  brand: string;
  advertiserRaw?: string;
  title: string;
  summary: string;
  adCopy: string;
  category: string;
  creativeType: string;
  creativeUrl?: string;
  thumbnailUrl?: string;
  landingPageUrl?: string;
  sourceAdUrl?: string;
  cta?: string;
  hashtags: string[];
  topics: string[];
  metrics?: {
    views?: string | number;
    likes?: string | number;
    comments?: string | number;
    impressions?: string | number;
  };
  additionalDetails?: string;
  rawRowData: Record<string, any>;
  searchConcepts: string[];
  fingerprint: string;
  createdAt: string;
  updatedAt: string;
}

export interface SheetTabConfig {
  id: string;
  sourceId: string;
  tabId: string;
  tabName: string;
  selected: boolean;
  platform: string;
  fieldMapping: Record<string, string>;
  mappingConfidence: number;
  lastScannedAt?: string;
}

export interface SheetSource {
  id: string;
  workspaceId?: string;
  spreadsheetId: string;
  spreadsheetUrl: string;
  sourceName: string;
  active: boolean;
  tabs: SheetTabConfig[];
  status?: 'active' | 'syncing' | 'error' | 'pending';
  lastSyncedAt?: string;
  recordCount?: number;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface AdSourceAssociation {
  id: string;
  adId: string;
  sourceId: string;
  tabId: string;
  rowNumber: number;
  sourceRowHash?: string;
  lastSeenAt: string;
}

export interface SyncJobCounts {
  sourcesScanned: number;
  tabsScanned: number;
  rowsExamined: number;
  newAdsCount: number;
  updatedAdsCount: number;
  unchangedAdsCount: number;
  skippedRowsCount: number;
  failedTabsCount: number;
}

export interface SyncJob {
  id: string;
  workspaceId?: string;
  status: 'queued' | 'running' | 'paused' | 'completed' | 'completed_with_errors' | 'failed' | 'cancelled';
  currentSourceId?: string;
  currentTabId?: string;
  currentStage?: string;
  progressPercent: number;
  checkpoint?: {
    sourceIndex: number;
    tabIndex: number;
    lastRow: number;
  };
  resultCounts: SyncJobCounts;
  startedAt: string;
  updatedAt: string;
  completedAt?: string;
  errors?: SyncJobError[];
}

export interface SyncJobError {
  id: string;
  jobId: string;
  sourceId?: string;
  tabId?: string;
  rowNumber?: number;
  errorCode:
    | 'INVALID_SOURCE_URL'
    | 'ACCESS_DENIED'
    | 'SPREADSHEET_NOT_FOUND'
    | 'TAB_NOT_FOUND'
    | 'GOOGLE_API_QUOTA'
    | 'GOOGLE_API_TEMPORARY_FAILURE'
    | 'INVALID_HEADER_MAPPING'
    | 'INVALID_ROW'
    | 'DATABASE_WRITE_FAILURE'
    | 'SYNC_LOCKED'
    | 'SYNC_TIMEOUT'
    | 'UNKNOWN_ERROR';
  errorMessage: string;
  retryable: boolean;
  createdAt: string;
}

export interface MatchExplanation {
  matchedFields: string[];
  exactMatch: boolean;
  brandMatch: boolean;
  scoreBreakdown: {
    exactScore: number;
    brandScore: number;
    phraseScore: number;
    fieldScore: number;
    semanticScore: number;
    featureScore: number;
    categoryScore: number;
    platformScore: number;
    total: number;
  };
  highlightTerms: string[];
  explanationNote: string;
}

export interface SearchResultItem {
  ad: CanonicalAd;
  score: number;
  confidence: 'high' | 'medium' | 'low';
  explanation: MatchExplanation;
}

export interface SearchResponse {
  query: string;
  parsedQuery: {
    normalized: string;
    terms: string[];
    detectedBrands: string[];
    detectedPlatforms: string[];
    detectedCategories: string[];
    detectedCreativeTypes: string[];
    detectedConcepts: string[];
    intent: string;
  };
  totalResults: number;
  results: SearchResultItem[];
  tookMs: number;
  suggestedQueries?: string[];
  availableFiltersSummary: {
    brandsCount: number;
    platformsCount: number;
    categoriesCount: number;
    creativeTypesCount: number;
    sourcesCount?: number;
    tabsCount?: number;
  };
}

export interface AggregatedFilters {
  brands: { name: string; count: number }[];
  platforms: { name: string; count: number }[];
  creativeTypes: { name: string; count: number }[];
  categories: { name: string; count: number }[];
  topics: { name: string; count: number }[];
  hashtags: { name: string; count: number }[];
  sources: { id: string; name: string; count: number }[];
  tabs: { id: string; name: string; count: number }[];
  totalAds: number;
}

export interface FilterState {
  q: string;
  brands: string[];
  platforms: string[];
  creativeTypes: string[];
  categories: string[];
  topics: string[];
  hashtags: string[];
  sources: string[];
  tabs: string[];
  sort: 'relevant' | 'newest' | 'oldest' | 'brand_asc' | 'brand_desc';
  page: number;
  limit: number;
  minConfidence: 'all' | 'medium' | 'high';
}

export interface DataSource extends SheetSource {}

export interface SyncStatus {
  isSyncing: boolean;
  currentStage: string;
  progressPercent: number;
  lastSyncedAt?: string;
  recordsCount: number;
  newAdsCount: number;
  updatedAdsCount: number;
  unchangedAdsCount: number;
  deletedAdsCount: number;
  error?: string;
  lastJob?: SyncJob;
}
