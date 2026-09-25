/**
 * Column Detection and Field Mapping Engine
 * Implements Algorithm B and Algorithm C from the specification
 */

export function normalizeHeader(value: string): string {
  if (!value) return '';
  return value
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export const FIELD_ALIASES: Record<string, string[]> = {
  company: [
    'company',
    'brand',
    'advertiser',
    'brand_name',
    'client',
    'account_name',
    'page_name',
    'advertiser_name',
  ],

  ad_url: [
    'ad_link',
    'reel_link',
    'video_link',
    'post_url',
    'url',
    'creative_link',
    'ad_url',
    'target_url',
    'original_ad_link',
    'link',
    'post_link',
    'destination_url',
  ],

  headline: [
    'ad_headline',
    'headline',
    'title',
    'hook',
    'video_hook',
    'ad_title',
    'main_heading',
    'heading',
  ],

  primary_text: [
    'primary_ad_text',
    'primary_text',
    'caption',
    'reel_content',
    'ad_copy',
    'body',
    'body_copy',
    'text',
    'description',
    'ad_description',
    'content',
  ],

  published_date: [
    'published_date',
    'post_date',
    'date',
    'publish_date',
    'start_date',
    'creation_date',
    'ad_start_date',
  ],

  views: [
    'views',
    'video_views',
    'view_count',
    'impressions_views',
    'play_count',
  ],

  likes: [
    'likes',
    'reactions',
    'like_count',
    'upvotes',
  ],

  comments: [
    'comments',
    'comment_count',
    'replies',
  ],

  impressions: [
    'impressions',
    'impression_count',
    'reach',
    'total_impressions',
    'approx_impressions',
    'est_impressions',
  ],

  keywords: [
    'keywords',
    'key_topics',
    'target_search_keyword',
    'topics',
    'tags',
    'search_terms',
  ],

  creative_type: [
    'ad_format',
    'creative_type',
    'content_type',
    'format',
    'media_type',
    'type',
  ],

  cta: [
    'cta',
    'call_to_action',
    'action_button',
    'button_text',
  ],

  transcript: [
    'transcript',
    'transcription',
    'audio_transcript',
    'video_transcript',
  ],

  landing_page_url: [
    'landing_page',
    'landing_page_url',
    'final_url',
    'lp_link',
    'lp_url',
  ],

  thumbnail_url: [
    'thumbnail',
    'thumbnail_url',
    'preview_image',
    'image_url',
  ],
};

export interface DetectedPlatformResult {
  platform: 'linkedin' | 'instagram' | 'meta' | 'google' | 'tiktok' | 'youtube' | 'unknown';
  confidence: number; // 0.0 to 1.0
  evidence: Record<string, number>;
  source: 'auto_high' | 'auto_suggested' | 'unknown';
}

/**
 * Platform detection using deterministic scoring
 */
export function detectPlatform(
  tabName: string,
  headers: string[],
  sampleRows: Record<string, any>[] = []
): DetectedPlatformResult {
  const evidence: Record<string, number> = {
    linkedin: 0,
    instagram: 0,
    meta: 0,
    google: 0,
    tiktok: 0,
    youtube: 0,
  };

  const normTab = normalizeHeader(tabName);

  // Tab name evidence
  if (normTab.includes('linkedin')) evidence.linkedin += 4;
  if (normTab.includes('instagram') || normTab.includes('insta') || normTab.includes('ig')) evidence.instagram += 4;
  if (normTab.includes('meta') || normTab.includes('facebook') || normTab.includes('fb')) evidence.meta += 4;
  if (normTab.includes('google') || normTab.includes('gads') || normTab.includes('search')) evidence.google += 4;
  if (normTab.includes('tiktok') || normTab.includes('tt')) evidence.tiktok += 4;
  if (normTab.includes('youtube') || normTab.includes('yt')) evidence.youtube += 4;

  // Normalized headers evidence
  const normalizedHeaders = headers.map(normalizeHeader);
  for (const h of normalizedHeaders) {
    if (h.includes('reel') || h.includes('instagram')) evidence.instagram += 2;
    if (h.includes('transparency') || h.includes('google')) evidence.google += 2;
    if (h.includes('linkedin') || h.includes('sponsored_content')) evidence.linkedin += 2;
    if (h.includes('fb_ad') || h.includes('page_id')) evidence.meta += 2;
  }

  // URL inspection in sample rows
  for (const row of sampleRows.slice(0, 10)) {
    const rowValues = Object.values(row).join(' ').toLowerCase();
    if (rowValues.includes('linkedin.com/feed/update') || rowValues.includes('linkedin.com/ad-library')) {
      evidence.linkedin += 5;
    }
    if (rowValues.includes('instagram.com/reel') || rowValues.includes('instagram.com/p/')) {
      evidence.instagram += 5;
    }
    if (rowValues.includes('facebook.com/ads/library') || rowValues.includes('fb.watch')) {
      evidence.meta += 5;
    }
    if (rowValues.includes('adstransparency.google.com') || rowValues.includes('google.com/search')) {
      evidence.google += 5;
    }
    if (rowValues.includes('tiktok.com/@') || rowValues.includes('ads.tiktok.com')) {
      evidence.tiktok += 5;
    }
    if (rowValues.includes('youtube.com/watch') || rowValues.includes('youtu.be')) {
      evidence.youtube += 5;
    }
  }

  let topPlatform: DetectedPlatformResult['platform'] = 'unknown';
  let highestScore = 0;

  for (const [p, score] of Object.entries(evidence)) {
    if (score > highestScore) {
      highestScore = score;
      topPlatform = p as DetectedPlatformResult['platform'];
    }
  }

  if (highestScore >= 5) {
    return {
      platform: topPlatform,
      confidence: Math.min(1.0, 0.6 + (highestScore * 0.05)),
      evidence,
      source: 'auto_high',
    };
  } else if (highestScore >= 2) {
    return {
      platform: topPlatform,
      confidence: 0.5,
      evidence,
      source: 'auto_suggested',
    };
  }

  return {
    platform: 'unknown',
    confidence: 0.0,
    evidence,
    source: 'unknown',
  };
}

/**
 * Match spreadsheet headers to canonical field keys
 */
export function detectFieldMappings(headers: string[]): {
  mappings: Record<string, string>; // canonicalKey -> rawHeaderName
  confidence: Record<string, number>;
} {
  const mappings: Record<string, string> = {};
  const confidence: Record<string, number> = {};

  const normalizedHeaderMap = new Map<string, string>();
  headers.forEach(h => {
    normalizedHeaderMap.set(normalizeHeader(h), h);
  });

  for (const [canonicalKey, aliases] of Object.entries(FIELD_ALIASES)) {
    for (const alias of aliases) {
      if (normalizedHeaderMap.has(alias)) {
        const rawHeader = normalizedHeaderMap.get(alias)!;
        mappings[canonicalKey] = rawHeader;
        confidence[canonicalKey] = 1.0;
        break;
      }
    }

    // Fuzzy contains check if exact match not found
    if (!mappings[canonicalKey]) {
      for (const [normHeader, rawHeader] of normalizedHeaderMap.entries()) {
        for (const alias of aliases) {
          if (normHeader.includes(alias) || alias.includes(normHeader)) {
            mappings[canonicalKey] = rawHeader;
            confidence[canonicalKey] = 0.75;
            break;
          }
        }
        if (mappings[canonicalKey]) break;
      }
    }
  }

  return { mappings, confidence };
}

/**
 * Normalizes a single spreadsheet row according to Algorithm C
 */
export interface NormalizedRowResult {
  valid: boolean;
  errors: string[];
  record?: {
    platform: string;
    platformAdId?: string;
    brand: string;
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
    metrics: {
      views?: string | number;
      likes?: string | number;
      comments?: string | number;
      impressions?: string | number;
    };
    rawRowData: Record<string, any>;
    rowNumber: number;
    sourceId: string;
    tabId: string;
  };
}

export function normalizeAdRow(params: {
  row: Record<string, any>;
  headers: string[];
  fieldMapping: Record<string, string>;
  platform: string;
  sourceId: string;
  tabId: string;
  rowNumber: number;
}): NormalizedRowResult {
  const { row, fieldMapping, platform, sourceId, tabId, rowNumber } = params;
  const errors: string[] = [];

  const getValue = (canonicalKey: string): string => {
    const headerName = fieldMapping[canonicalKey];
    if (!headerName || row[headerName] === undefined || row[headerName] === null) {
      return '';
    }
    const val = String(row[headerName]).trim();
    return val === 'null' || val === 'undefined' ? '' : val;
  };

  const getNumberValue = (canonicalKey: string): string | number | undefined => {
    const val = getValue(canonicalKey);
    if (!val) return undefined;
    // Clean strings like "1,200", "5.4k", "100+", etc.
    const cleanStr = val.replace(/,/g, '').trim();
    if (!isNaN(Number(cleanStr))) {
      return Number(cleanStr);
    }
    return val;
  };

  const adUrl = getValue('ad_url');
  const company = getValue('company') || 'Unknown Brand';
  const headline = getValue('headline');
  const primaryText = getValue('primary_text');
  const cta = getValue('cta');
  const creativeType = getValue('creative_type') || (adUrl.includes('reel') || adUrl.includes('video') ? 'Video Ad' : 'Single Image Ad');
  const keywordsStr = getValue('keywords');
  const impressions = getNumberValue('impressions');
  const views = getNumberValue('views');
  const likes = getNumberValue('likes');
  const comments = getNumberValue('comments');

  // Parse topics/keywords
  const topics: string[] = keywordsStr
    ? keywordsStr.split(/[,;\n|]+/).map(t => t.trim()).filter(Boolean)
    : [];

  // Parse hashtags from primary text
  const hashtagMatches = (primaryText || '').match(/#[a-zA-Z0-9_]+/g) || [];
  const hashtags = Array.from(new Set(hashtagMatches.map(h => h.trim())));

  // Validation according to Algorithm C:
  // Must have adUrl or identifiable content + at least one descriptive field
  const hasIdentifier = Boolean(adUrl);
  const hasDescription = Boolean(company || headline || primaryText);

  if (!hasIdentifier && !hasDescription) {
    errors.push(`Row ${rowNumber}: Missing both an Ad URL and descriptive fields (company/headline/body).`);
    return { valid: false, errors };
  }

  // Preserve all raw fields
  const cleanRawData: Record<string, any> = {};
  for (const [k, v] of Object.entries(row)) {
    if (v !== undefined && v !== null && v !== 'null' && v !== 'undefined') {
      cleanRawData[k] = typeof v === 'string' ? v.trim() : v;
    }
  }

  return {
    valid: true,
    errors: [],
    record: {
      platform: platform || 'google',
      brand: company,
      title: headline || (primaryText ? primaryText.slice(0, 80) : 'Ad Creative'),
      summary: primaryText ? primaryText.slice(0, 160) : (headline || ''),
      adCopy: primaryText || headline || '',
      category: 'General',
      creativeType,
      creativeUrl: adUrl,
      sourceAdUrl: adUrl,
      landingPageUrl: getValue('landing_page_url') || undefined,
      thumbnailUrl: getValue('thumbnail_url') || undefined,
      cta: cta || undefined,
      hashtags,
      topics,
      metrics: {
        views,
        likes,
        comments,
        impressions,
      },
      rawRowData: cleanRawData,
      rowNumber,
      sourceId,
      tabId,
    },
  };
}
