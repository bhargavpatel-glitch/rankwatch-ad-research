export interface CanonicalAd {
  id: string;
  sourceSheetId: string;
  sourceTab: string;
  platform: string;
  brand: string;
  advertiserRaw: string;
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
  };
}

export interface AggregatedFilters {
  brands: { name: string; count: number }[];
  platforms: { name: string; count: number }[];
  creativeTypes: { name: string; count: number }[];
  categories: { name: string; count: number }[];
  topics: { name: string; count: number }[];
  hashtags: { name: string; count: number }[];
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
  sort: 'relevant' | 'newest' | 'oldest' | 'brand_asc' | 'brand_desc';
  page: number;
  limit: number;
  minConfidence: 'all' | 'medium' | 'high';
}

export interface DataSource {
  id: string;
  name: string;
  url: string;
  sheetId: string;
  status: 'active' | 'syncing' | 'error' | 'pending';
  lastSyncedAt?: string;
  recordCount: number;
  tabs: string[];
  errorMessage?: string;
}

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
}
