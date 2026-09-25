/**
 * Deduplication & Identity Engine
 * Implements Algorithm D and Algorithm E from the specification
 */

import { CanonicalAd } from '../types';

/**
 * Normalizes text for stable fingerprinting
 */
export function normalizeText(text?: string): string {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s]/g, '');
}

/**
 * Level 1: Extract platform-specific Ad ID from URL or fields
 */
export function extractPlatformAdId(platform: string, url?: string): string | undefined {
  if (!url) return undefined;
  const cleanUrl = url.trim();

  // 1. LinkedIn Ad ID
  // e.g. https://www.linkedin.com/feed/update/urn:li:activity:723456789/ or urn:li:share:123
  const linkedinMatch = cleanUrl.match(/urn:li:(?:activity|ugcPost|share|digitalmediaAsset):(\d+)/i) ||
                        cleanUrl.match(/\/update\/(?:urn:li:[^/]+:)?(\d+)/i) ||
                        cleanUrl.match(/\/ad-library\/detail\/(\d+)/i);
  if (linkedinMatch) return linkedinMatch[1];

  // 2. Google Ads Transparency ID
  // e.g. https://adstransparency.google.com/advertiser/AR123/creative/CR456...
  const googleMatch = cleanUrl.match(/\/creative\/([A-Za-z0-9_-]+)/i) ||
                      cleanUrl.match(/creative_id=([A-Za-z0-9_-]+)/i);
  if (googleMatch) return googleMatch[1];

  // 3. Meta / Facebook Ad Library ID
  // e.g. https://www.facebook.com/ads/library/?id=1234567890
  const metaMatch = cleanUrl.match(/[?&]id=(\d{10,})/i) ||
                    cleanUrl.match(/\/videos\/(\d{10,})/i) ||
                    cleanUrl.match(/\/posts\/(\d{10,})/i);
  if (metaMatch) return metaMatch[1];

  // 4. Instagram Post / Reel Shortcode
  // e.g. https://www.instagram.com/reel/C-xyz123/ or /p/C-xyz123/
  const igMatch = cleanUrl.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/i);
  if (igMatch) return igMatch[1];

  // 5. TikTok Video ID
  // e.g. https://www.tiktok.com/@user/video/7123456789012345678
  const tiktokMatch = cleanUrl.match(/\/video\/(\d{15,})/i);
  if (tiktokMatch) return tiktokMatch[1];

  // 6. YouTube Video ID
  // e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or youtu.be/dQw4w9WgXcQ
  const ytMatch = cleanUrl.match(/(?:v=|\/embed\/|\.be\/)([a-zA-Z0-9_-]{11})/i);
  if (ytMatch) return ytMatch[1];

  // Fallback: Check trailing digits if at least 6 digits
  const trailingDigits = cleanUrl.match(/\/(\d{6,})(?:\/|\?|$)/);
  if (trailingDigits) return trailingDigits[1];

  return undefined;
}

/**
 * Level 2: Clean and normalize source ad URL
 */
export function normalizeAdUrl(url?: string): string | undefined {
  if (!url) return undefined;
  let clean = url.trim();
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = 'https://' + clean;
  }

  try {
    const parsed = new URL(clean);
    
    // Normalize hostname
    let host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let pathname = parsed.pathname.replace(/\/+$/, ''); // Remove trailing slashes

    // Filter tracking parameters while keeping critical identity parameters
    const trackingParams = new Set([
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'fbclid', 'gclid', 'igsh', 'ref', 'ref_src', 'src', '_r', 'is_copy_url',
      'si', 'feature', 'share_id', 'ved', 'ei', 'session_id'
    ]);

    const filteredParams = new URLSearchParams();
    parsed.searchParams.forEach((value, key) => {
      if (!trackingParams.has(key.toLowerCase())) {
        filteredParams.append(key, value);
      }
    });

    const searchStr = filteredParams.toString() ? `?${filteredParams.toString()}` : '';
    return `${parsed.protocol}//${host}${pathname}${searchStr}`;
  } catch {
    return clean.toLowerCase().replace(/[?#].*$/, '').replace(/\/+$/, '');
  }
}

/**
 * Fast stable hash code for Level 3 fingerprinting
 */
export function generateContentFingerprint(params: {
  platform: string;
  company: string;
  headline?: string;
  primaryText?: string;
  publishedDate?: string;
}): string {
  const normPlatform = normalizeText(params.platform);
  const normCompany = normalizeText(params.company);
  const normHeadline = normalizeText(params.headline);
  const normPrimary = normalizeText(params.primaryText);
  const normDate = normalizeText(params.publishedDate);

  const rawString = `${normPlatform}|${normCompany}|${normHeadline}|${normPrimary.slice(0, 100)}|${normDate}`;
  
  // Deterministic 32-bit FNV-1a hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < rawString.length; i++) {
    hash ^= rawString.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fp_${(hash >>> 0).toString(16)}`;
}

/**
 * Build complete identity for an ad record
 */
export interface AdIdentity {
  reliable: boolean;
  platformAdId?: string;
  normalizedUrl?: string;
  fingerprint: string;
  lookupKey: string;
}

export function createAdIdentity(ad: {
  platform: string;
  brand: string;
  title?: string;
  adCopy?: string;
  sourceAdUrl?: string;
  creativeUrl?: string;
}): AdIdentity {
  const targetUrl = ad.sourceAdUrl || ad.creativeUrl;
  const platformAdId = extractPlatformAdId(ad.platform, targetUrl);
  const normalizedUrl = normalizeAdUrl(targetUrl);
  const fingerprint = generateContentFingerprint({
    platform: ad.platform,
    company: ad.brand,
    headline: ad.title,
    primaryText: ad.adCopy,
  });

  // Hierarchy: Level 1 (platformAdId) > Level 2 (normalizedUrl) > Level 3 (fingerprint)
  let lookupKey = '';
  let reliable = false;

  if (platformAdId) {
    lookupKey = `id:${ad.platform.toLowerCase()}:${platformAdId}`;
    reliable = true;
  } else if (normalizedUrl) {
    lookupKey = `url:${normalizedUrl}`;
    reliable = true;
  } else if (ad.brand && (ad.title || ad.adCopy)) {
    lookupKey = `fp:${fingerprint}`;
    reliable = true;
  } else {
    lookupKey = `fp:${fingerprint}`;
    reliable = false;
  }

  return {
    reliable,
    platformAdId,
    normalizedUrl,
    fingerprint,
    lookupKey,
  };
}

/**
 * Compare two ads for meaningful content changes (Algorithm E)
 */
export function hasMeaningfulChanges(existing: CanonicalAd, incoming: Partial<CanonicalAd>): boolean {
  if (incoming.title && incoming.title !== existing.title) return true;
  if (incoming.adCopy && incoming.adCopy !== existing.adCopy) return true;
  if (incoming.cta && incoming.cta !== existing.cta) return true;
  if (incoming.creativeType && incoming.creativeType !== existing.creativeType) return true;
  if (incoming.landingPageUrl && incoming.landingPageUrl !== existing.landingPageUrl) return true;
  
  // Metrics change check
  if (incoming.metrics) {
    const exMetrics = existing.metrics || {};
    const inMetrics = incoming.metrics;
    if (inMetrics.views !== undefined && inMetrics.views !== exMetrics.views) return true;
    if (inMetrics.likes !== undefined && inMetrics.likes !== exMetrics.likes) return true;
    if (inMetrics.comments !== undefined && inMetrics.comments !== exMetrics.comments) return true;
    if (inMetrics.impressions !== undefined && inMetrics.impressions !== exMetrics.impressions) return true;
  }

  return false;
}

/**
 * Merge existing ad with incoming record (Algorithm E Merge Policy)
 */
export function mergeAdData(existing: CanonicalAd, incoming: Partial<CanonicalAd>): CanonicalAd {
  return {
    ...existing,
    title: incoming.title || existing.title,
    summary: incoming.summary || existing.summary,
    adCopy: incoming.adCopy || existing.adCopy,
    cta: incoming.cta || existing.cta,
    creativeType: incoming.creativeType || existing.creativeType,
    creativeUrl: incoming.creativeUrl || existing.creativeUrl,
    thumbnailUrl: incoming.thumbnailUrl || existing.thumbnailUrl,
    landingPageUrl: incoming.landingPageUrl || existing.landingPageUrl,
    sourceAdUrl: incoming.sourceAdUrl || existing.sourceAdUrl,
    metrics: {
      ...existing.metrics,
      ...(incoming.metrics?.views !== undefined ? { views: incoming.metrics.views } : {}),
      ...(incoming.metrics?.likes !== undefined ? { likes: incoming.metrics.likes } : {}),
      ...(incoming.metrics?.comments !== undefined ? { comments: incoming.metrics.comments } : {}),
      ...(incoming.metrics?.impressions !== undefined ? { impressions: incoming.metrics.impressions } : {}),
    },
    rawRowData: {
      ...existing.rawRowData,
      ...incoming.rawRowData,
    },
    updatedAt: new Date().toISOString(),
  };
}
