/**
 * Algorithmic & Deduplication Validation Test Suite
 * Tests Algorithm B, C, D, E implementations
 */

import { normalizeHeader, FIELD_ALIASES, detectPlatform, detectFieldMappings, normalizeAdRow } from '../frontend/src/utils/columnDetector';
import { extractPlatformAdId, normalizeAdUrl, generateContentFingerprint, createAdIdentity, hasMeaningfulChanges, mergeAdData } from '../frontend/src/utils/deduplication';

function runTests() {
  console.log('=== RUNNING SYNC & DEDUPLICATION ALGORITHM VALIDATION ===\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  [PASS] ${testName}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}`);
    }
  }

  // 1. Header Normalization (Algorithm B)
  console.log('1. Testing Header Normalization:');
  assert(normalizeHeader('Ad Link') === 'ad_link', 'Normalizes "Ad Link" to "ad_link"');
  assert(normalizeHeader('AD LINK') === 'ad_link', 'Normalizes "AD LINK" to "ad_link"');
  assert(normalizeHeader('Primary Ad Text') === 'primary_ad_text', 'Normalizes "Primary Ad Text" to "primary_ad_text"');
  assert(normalizeHeader('Keywords / Topic') === 'keywords_topic', 'Normalizes "Keywords / Topic" to "keywords_topic"');
  assert(normalizeHeader('Published Date') === 'published_date', 'Normalizes "Published Date" to "published_date"');
  assert(normalizeHeader('Views') === 'views', 'Normalizes "Views" to "views"');

  // 2. Platform Detection (Algorithm B)
  console.log('\n2. Testing Platform Detection Scoring:');
  const liDetected = detectPlatform('LinkedIn Sponsored Ads', ['Ad Headline', 'Reactions'], [{ url: 'https://www.linkedin.com/feed/update/urn:li:activity:723456789' }]);
  assert(liDetected.platform === 'linkedin' && liDetected.confidence >= 0.7, 'Detects LinkedIn with high confidence');

  const igDetected = detectPlatform('Instagram Reels', ['Reel Link', 'Views'], [{ url: 'https://www.instagram.com/reel/C-xyz123/' }]);
  assert(igDetected.platform === 'instagram' && igDetected.confidence >= 0.7, 'Detects Instagram with high confidence');

  const gadsDetected = detectPlatform('Google Search Creatives', ['Target URL'], [{ url: 'https://adstransparency.google.com/advertiser/AR123/creative/CR456' }]);
  assert(gadsDetected.platform === 'google' && gadsDetected.confidence >= 0.7, 'Detects Google Ads with high confidence');

  // 3. Field Mapping (Algorithm B)
  console.log('\n3. Testing Canonical Field Mapping:');
  const detectedMappings = detectFieldMappings(['Ad Link', 'Brand Name', 'Ad Headline', 'Primary Text', 'Reactions', 'Total Impressions']);
  assert(detectedMappings.mappings.company === 'Brand Name', 'Maps "Brand Name" to company');
  assert(detectedMappings.mappings.ad_url === 'Ad Link', 'Maps "Ad Link" to ad_url');
  assert(detectedMappings.mappings.headline === 'Ad Headline', 'Maps "Ad Headline" to headline');
  assert(detectedMappings.mappings.likes === 'Reactions', 'Maps "Reactions" to likes');
  assert(detectedMappings.mappings.impressions === 'Total Impressions', 'Maps "Total Impressions" to impressions');

  // 4. Row Normalization (Algorithm C)
  console.log('\n4. Testing Row Normalization (Algorithm C):');
  const normRes = normalizeAdRow({
    row: {
      'Brand Name': 'Semrush',
      'Ad Link': 'https://www.linkedin.com/feed/update/urn:li:activity:723456789',
      'Ad Headline': 'Enterprise SEO Platform',
      'Primary Text': 'Scale your organic traffic #seo #semrush',
      'Total Impressions': '15,000',
    },
    headers: ['Brand Name', 'Ad Link', 'Ad Headline', 'Primary Text', 'Total Impressions'],
    fieldMapping: detectedMappings.mappings,
    platform: 'linkedin',
    sourceId: 'src_1',
    tabId: 'tab_1',
    rowNumber: 2,
  });
  assert(normRes.valid === true, 'Row validates successfully');
  assert(normRes.record?.brand === 'Semrush', 'Preserves brand');
  assert(normRes.record?.metrics.impressions === 15000, 'Parses numeric impressions');
  assert(normRes.record?.hashtags.includes('#seo'), 'Extracts hashtags');

  // 5. Deduplication Level 1, 2, 3 (Algorithm D)
  console.log('\n5. Testing Deduplication Hierarchy (Algorithm D):');
  const liAdId = extractPlatformAdId('linkedin', 'https://www.linkedin.com/feed/update/urn:li:activity:723456789?utm_source=fb');
  assert(liAdId === '723456789', 'Extracts Level 1 LinkedIn Ad ID');

  const gadsId = extractPlatformAdId('google', 'https://adstransparency.google.com/advertiser/AR123/creative/CR987654321');
  assert(gadsId === 'CR987654321', 'Extracts Level 1 Google Ads Transparency ID');

  const metaId = extractPlatformAdId('meta', 'https://www.facebook.com/ads/library/?id=987654321012345&active_status=all');
  assert(metaId === '987654321012345', 'Extracts Level 1 Meta Ad Library ID');

  const normUrl = normalizeAdUrl('https://www.example.com/ad/path/?utm_source=google&utm_campaign=winter&id=123#frag');
  assert(normUrl === 'https://example.com/ad/path?id=123', 'Level 2 URL normalizer strips UTMs and preserves ID');

  const fp1 = generateContentFingerprint({ platform: 'linkedin', company: 'Semrush', headline: 'AI Visibility', primaryText: 'Boost SEO' });
  const fp2 = generateContentFingerprint({ platform: 'linkedin', company: 'Semrush', headline: 'AI Visibility', primaryText: 'Boost SEO' });
  const fp3 = generateContentFingerprint({ platform: 'linkedin', company: 'Semrush', headline: 'Different Hook', primaryText: 'Boost SEO' });
  assert(fp1 === fp2, 'Level 3 content fingerprint is deterministic');
  assert(fp1 !== fp3, 'Different content produces distinct fingerprint');

  // 6. Content Comparison & Upsert (Algorithm E)
  console.log('\n6. Testing Content Comparison & Upsert (Algorithm E):');
  const existingAd: any = {
    id: 'ad_1',
    brand: 'Semrush',
    title: 'Old Title',
    adCopy: 'Old Copy',
    metrics: { views: 100 },
    rawRowData: {},
  };
  assert(hasMeaningfulChanges(existingAd, { title: 'New Title' }) === true, 'Detects title change');
  assert(hasMeaningfulChanges(existingAd, { title: 'Old Title' }) === false, 'Detects unchanged record');

  const merged = mergeAdData(existingAd, { title: 'New Title', metrics: { views: 250, impressions: 5000 } });
  assert(merged.title === 'New Title', 'Merges updated title');
  assert(merged.metrics.views === 250 && merged.metrics.impressions === 5000, 'Merges updated metrics');

  console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
}

runTests();
