import { CanonicalAd, FilterState, SearchResponse, SearchResultItem, AggregatedFilters } from '../types';
import { AdGroup } from '../components/SaveToGroupModal';

let cachedAds: CanonicalAd[] | null = null;

// Extract human-readable Ad ID (the number or ID code at the end of the URL, or clean ad id)
export function getAdDisplayId(ad: CanonicalAd): string {
  const url = ad.sourceAdUrl || '';
  if (url) {
    try {
      const urlObj = new URL(url);
      // 1. Direct query param IDs
      if (urlObj.searchParams.get('id')) return urlObj.searchParams.get('id')!;
      if (urlObj.searchParams.get('ad_id')) return urlObj.searchParams.get('ad_id')!;
      if (urlObj.searchParams.get('view_all_page_id')) return urlObj.searchParams.get('view_all_page_id')!;

      // 2. Clean pathname
      const cleanPath = urlObj.pathname.replace(/\/+$/, '');
      const segments = cleanPath.split('/').filter(Boolean);
      if (segments.length > 0) {
        const last = segments[segments.length - 1];
        if (last && last !== 'library' && last !== 'anywhere') {
          return last;
        }
        if (segments.length > 1) {
          return segments[segments.length - 2];
        }
      }
    } catch {
      const match = url.match(/([0-9A-Za-z_]{6,})/g);
      if (match && match.length > 0) return match[match.length - 1];
    }
  }
  return (ad.id || '').replace(/^ad_/, '');
}

export async function loadPreloadedAds(): Promise<CanonicalAd[]> {
  if (cachedAds && cachedAds.length > 0) return cachedAds;

  try {
    const res = await fetch('/data/ads.json');
    if (!res.ok) throw new Error('Failed to load /data/ads.json: ' + res.status);
    const data: CanonicalAd[] = await res.json();
    // Only keep ads that have an original source ad link as requested by user
    cachedAds = data.filter(ad => !!(ad.sourceAdUrl && ad.sourceAdUrl.trim()));
    return cachedAds;
  } catch (err) {
    console.warn('Could not load /data/ads.json:', err);
    return [];
  }
}

export function getClientFilters(ads: CanonicalAd[]): AggregatedFilters {
  const brandMap = new Map<string, number>();
  const platformMap = new Map<string, number>();
  const typeMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();

  for (const ad of ads) {
    if (ad.brand) {
      brandMap.set(ad.brand, (brandMap.get(ad.brand) || 0) + 1);
    }
    if (ad.platform) {
      platformMap.set(ad.platform, (platformMap.get(ad.platform) || 0) + 1);
    }
    if (ad.creativeType) {
      typeMap.set(ad.creativeType, (typeMap.get(ad.creativeType) || 0) + 1);
    }
    if (ad.category) {
      categoryMap.set(ad.category, (categoryMap.get(ad.category) || 0) + 1);
    }
  }

  const toArr = (map: Map<string, number>) =>
    Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

  return {
    brands: toArr(brandMap),
    platforms: toArr(platformMap),
    creativeTypes: toArr(typeMap),
    categories: toArr(categoryMap),
    topics: [],
    hashtags: [],
    totalAds: ads.length
  };
}

export function searchClientAds(
  ads: CanonicalAd[],
  query: string,
  filters: FilterState,
  page: number = 1,
  limit: number = 40
): SearchResponse {
  const startTime = performance.now();
  const qClean = (query || '').toLowerCase().trim();
  const terms = qClean ? qClean.split(/\s+/).filter(Boolean) : [];

  // Guarantee we only process ads with a valid original ad link
  let filtered = ads.filter(a => !!(a.sourceAdUrl && a.sourceAdUrl.trim()));

  // Filter: Brands
  if (filters.brands && filters.brands.length > 0) {
    const bSet = new Set(filters.brands.map(b => b.toLowerCase()));
    filtered = filtered.filter(a => a.brand && bSet.has(a.brand.toLowerCase()));
  }

  // Filter: Platforms
  if (filters.platforms && filters.platforms.length > 0) {
    const pSet = new Set(filters.platforms.map(p => p.toLowerCase()));
    filtered = filtered.filter(a => a.platform && pSet.has(a.platform.toLowerCase()));
  }

  // Filter: Creative Types
  if (filters.creativeTypes && filters.creativeTypes.length > 0) {
    const cSet = new Set(filters.creativeTypes.map(c => c.toLowerCase()));
    filtered = filtered.filter(a => a.creativeType && cSet.has(a.creativeType.toLowerCase()));
  }

  // Filter: Categories
  if (filters.categories && filters.categories.length > 0) {
    const catSet = new Set(filters.categories.map(c => c.toLowerCase()));
    filtered = filtered.filter(a => a.category && catSet.has(a.category.toLowerCase()));
  }

  // Score & Rank
  const scoredItems: SearchResultItem[] = [];

  for (let i = 0; i < filtered.length; i++) {
    const ad = filtered[i];
    let score = 50; // base score
    const matchedFields: string[] = [];
    let exactMatch = false;
    let brandMatch = false;

    if (terms.length > 0) {
      let termScore = 0;
      const titleLower = (ad.title || '').toLowerCase();
      const brandLower = (ad.brand || '').toLowerCase();
      const summaryLower = (ad.summary || '').toLowerCase();
      const copyLower = (ad.adCopy || '').toLowerCase();
      const platformLower = (ad.platform || '').toLowerCase();
      const concepts = (ad.searchConcepts || []).map(c => c.toLowerCase());

      // Exact phrase check
      if (titleLower.includes(qClean) || brandLower.includes(qClean)) {
        termScore += 40;
        exactMatch = true;
        matchedFields.push('title');
      }

      if (brandLower.includes(qClean)) {
        termScore += 35;
        brandMatch = true;
        matchedFields.push('brand');
      }

      for (const t of terms) {
        if (brandLower.includes(t)) {
          termScore += 25;
          brandMatch = true;
          if (!matchedFields.includes('brand')) matchedFields.push('brand');
        }
        if (titleLower.includes(t)) {
          termScore += 20;
          if (!matchedFields.includes('title')) matchedFields.push('title');
        }
        if (concepts.some(c => c.includes(t))) {
          termScore += 15;
          if (!matchedFields.includes('concepts')) matchedFields.push('concepts');
        }
        if (summaryLower.includes(t) || copyLower.includes(t)) {
          termScore += 10;
          if (!matchedFields.includes('adCopy')) matchedFields.push('adCopy');
        }
        if (platformLower.includes(t)) {
          termScore += 10;
          if (!matchedFields.includes('platform')) matchedFields.push('platform');
        }
      }

      // If search query has terms but ad matched none, discard it
      if (termScore === 0) continue;
      score = Math.min(100, score + termScore);
    }

    scoredItems.push({
      ad,
      score,
      confidence: score > 75 ? 'high' : score > 50 ? 'medium' : 'low',
      explanation: {
        matchedFields,
        exactMatch,
        brandMatch,
        scoreBreakdown: {
          exactScore: exactMatch ? 30 : 0,
          brandScore: brandMatch ? 25 : 0,
          phraseScore: 15,
          fieldScore: 10,
          semanticScore: 10,
          featureScore: 5,
          categoryScore: 5,
          platformScore: 5,
          total: score
        },
        highlightTerms: terms,
        explanationNote: matchedFields.length > 0
          ? 'Matched in ' + matchedFields.join(', ')
          : 'Ranked ad'
      }
    });
  }

  // Sort based on sort option
  const sortMode = filters.sort || 'relevant';
  if (sortMode === 'newest') {
    scoredItems.reverse();
  } else if (sortMode === 'oldest') {
    // Keep as is (original order)
  } else if (sortMode === 'brand_asc') {
    scoredItems.sort((a, b) => (a.ad.brand || '').localeCompare(b.ad.brand || ''));
  } else if (sortMode === 'brand_desc') {
    scoredItems.sort((a, b) => (b.ad.brand || '').localeCompare(a.ad.brand || ''));
  } else {
    // 'relevant': sort descending by relevance score
    if (terms.length > 0) {
      scoredItems.sort((a, b) => b.score - a.score);
    }
  }

  const totalResults = scoredItems.length;
  const startIdx = (page - 1) * limit;
  const pageResults = scoredItems.slice(startIdx, startIdx + limit);
  const elapsed = Math.round(performance.now() - startTime);

  return {
    query,
    parsedQuery: {
      normalized: qClean,
      terms,
      detectedBrands: filters.brands || [],
      detectedPlatforms: filters.platforms || [],
      detectedCategories: filters.categories || [],
      detectedCreativeTypes: filters.creativeTypes || [],
      detectedConcepts: [],
      intent: 'search'
    },
    totalResults,
    results: pageResults,
    tookMs: Math.max(1, elapsed),
    availableFiltersSummary: {
      brandsCount: new Set(filtered.map(a => a.brand)).size,
      platformsCount: new Set(filtered.map(a => a.platform)).size,
      categoriesCount: new Set(filtered.map(a => a.category)).size,
      creativeTypesCount: new Set(filtered.map(a => a.creativeType)).size
    },
    suggestedQueries: ['AI Visibility', 'Enterprise Pricing', 'Semrush', 'Profound', 'Demo']
  };
}

export function getClientSimilarAds(ads: CanonicalAd[], targetAd: CanonicalAd, limit: number = 6): CanonicalAd[] {
  const targetBrand = (targetAd.brand || '').toLowerCase();
  const targetCategory = (targetAd.category || '').toLowerCase();
  const targetPlatform = (targetAd.platform || '').toLowerCase();

  return ads
    .filter(a => a.id !== targetAd.id && !!(a.sourceAdUrl && a.sourceAdUrl.trim()))
    .map(a => {
      let sim = 0;
      if (a.brand && a.brand.toLowerCase() === targetBrand) sim += 30;
      if (a.category && a.category.toLowerCase() === targetCategory) sim += 25;
      if (a.platform && a.platform.toLowerCase() === targetPlatform) sim += 15;
      return { ad: a, sim };
    })
    .sort((a, b) => b.sim - a.sim)
    .slice(0, limit)
    .map(x => x.ad);
}

// LocalStorage Persistence for Groups & Liked Ads on Netlify
const STORAGE_KEY = 'rankwatch_ad_saved_groups';

export function loadClientSavedGroups(): AdGroup[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Error reading saved groups from localStorage', e);
  }

  return [
    {
      id: 'liked',
      name: 'Liked Ads',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      adIds: []
    }
  ];
}

export function saveClientSavedGroups(groups: AdGroup[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(groups));
  } catch (e) {
    console.warn('Error saving groups to localStorage', e);
  }
}

