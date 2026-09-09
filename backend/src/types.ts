export interface CanonicalAd {
  id: string;                      // Stable unique ID
  sourceSheetId: string;           // Google Sheet document ID
  sourceTab: string;               // Tab Name (e.g., 'Google Ads', 'Linkedin ad research')
  platform: string;                // 'Google Ads' | 'Meta Ads' | 'Instagram' | 'LinkedIn' | string
  brand: string;                   // Clean Brand Name (e.g. 'Semrush', 'Peec AI', 'Cooper Square Technologies')
  advertiserRaw: string;           // Original raw advertiser field
  title: string;                   // Headline or Hook
  summary: string;                 // Concise summary / description
  adCopy: string;                  // Full caption / body copy
  category: string;                // Category (e.g., 'Software / AI', 'Comparison / Case Study')
  subcategory?: string;            // Secondary taxonomy
  creativeType: string;            // 'Single Image Ad' | 'Document Ad' | 'Video' | 'Reel' | 'Carousel' | 'Post'
  creativeUrl?: string;            // Direct image/video URL
  thumbnailUrl?: string;           // Computed or direct thumbnail
  landingPageUrl?: string;         // Target destination URL
  sourceAdUrl?: string;            // Transparency link / Meta Ad Library / LinkedIn Ad Library link
  cta?: string;                    // CTA button text (e.g., 'Learn more', 'Sign up')
  hashtags: string[];              // Normalized hashtags array
  topics: string[];                // Domain topics/keywords (e.g., 'AEO', 'GEO', 'SEO', 'AI Search')
  metrics?: {
    views?: string | number;
    likes?: string | number;
    comments?: string | number;
  };
  additionalDetails?: string;      // Ran dates, notes, impressions, etc.
  rawRowData: Record<string, any>; // Complete original row data
  
  // Search & Indexing metadata
  searchDocument: string;          // Weighted composite text for search
  searchConcepts: string[];        // Extracted semantic concept tokens
  fingerprint: string;             // Hash for sync change detection
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

export interface FilterOptions {
  q?: string;
  brands?: string[];
  platforms?: string[];
  creativeTypes?: string[];
  categories?: string[];
  topics?: string[];
  hashtags?: string[];
  sort?: 'relevant' | 'newest' | 'oldest' | 'brand_asc' | 'brand_desc';
  page?: number;
  limit?: number;
  minConfidence?: 'all' | 'medium' | 'high';
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
