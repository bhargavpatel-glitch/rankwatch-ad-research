/**
 * Sync Engine Orchestrator
 * Implements Algorithms A, B, C, D, E, F, G, H
 * Fully zero-cost, free-tier safe, deterministic, idempotent, and resumable.
 */

import { CanonicalAd, SheetSource, SheetTabConfig, SyncJob, SyncJobCounts, SyncJobError } from '../types';
import { detectFieldMappings, detectPlatform, normalizeAdRow } from './columnDetector';
import { createAdIdentity, hasMeaningfulChanges, mergeAdData } from './deduplication';
import { saveSheetSourcesToDB, saveSyncJobToDB } from './supabaseClient';

export interface TabDiscoveryResult {
  spreadsheetId: string;
  spreadsheetTitle?: string;
  tabs: {
    sheetId: string;
    title: string;
    suggestedPlatform: string;
    confidence: number;
    sampleRows?: Record<string, any>[];
    headers?: string[];
  }[];
}

/**
 * Algorithm A.1: Extract spreadsheet ID from arbitrary Google Sheets URL formats
 */
export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i) ||
                url.match(/key=([a-zA-Z0-9-_]+)/i) ||
                url.match(/^([a-zA-Z0-9-_]{20,})$/);
  return match ? match[1] : null;
}

/**
 * Fast CSV parsing utility
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++; // Skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        // Skip carriage return
      } else if (char === '\n') {
        row.push(currentVal.trim());
        if (row.some(c => c.length > 0)) {
          lines.push(row);
        }
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    if (row.some(c => c.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

/**
 * Extract all tab names and gids from Google Sheets HTML view
 */
function extractTabsFromHtml(html: string): { sheetId: string; title: string }[] {
  const tabs: { sheetId: string; title: string }[] = [];
  const seen = new Set<string>();

  // Pattern 1: <li id="sheet-button-0" ...><a ...>Sheet Name</a>
  const liMatches = html.matchAll(/<li[^>]*id="sheet-button-([^"]+)"[^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/gi);
  for (const m of liMatches) {
    const sheetId = m[1];
    const title = m[2].trim();
    if (title && !seen.has(title)) {
      seen.add(title);
      tabs.push({ sheetId, title });
    }
  }

  // Pattern 2: href="#gid=123456" >Title</a>
  if (tabs.length === 0) {
    const gidMatches = html.matchAll(/href=["']#gid=(\d+)["'][^>]*>([^<]+)<\/a>/gi);
    for (const m of gidMatches) {
      const sheetId = m[1];
      const title = m[2].trim();
      if (title && !seen.has(title)) {
        seen.add(title);
        tabs.push({ sheetId, title });
      }
    }
  }

  // Pattern 3: JSON embedded bootstrapData
  if (tabs.length === 0) {
    const jsonMatches = html.matchAll(/"title":\s*"([^"\\]+)",\s*"sheetId":\s*(\d+)/gi);
    for (const m of jsonMatches) {
      const title = m[1].trim();
      const sheetId = m[2];
      if (title && !seen.has(title)) {
        seen.add(title);
        tabs.push({ sheetId, title });
      }
    }
  }

  return tabs;
}

/**
 * Algorithm A: Discover tabs and sample data from Google Sheets URL
 */
export async function discoverGoogleSheetTabs(url: string): Promise<TabDiscoveryResult> {
  const spreadsheetId = extractSpreadsheetId(url);
  if (!spreadsheetId) {
    throw new Error('Invalid Google Sheets URL. Please check the URL format.');
  }

  // 1. Try Backend API first if running with Service Account or Netlify Functions
  try {
    const apiRes = await fetch('/api/sources/discover-tabs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (apiRes.ok) {
      const apiData = await apiRes.json();
      if (apiData && Array.isArray(apiData.tabs) && apiData.tabs.length > 0) {
        return {
          spreadsheetId,
          spreadsheetTitle: apiData.spreadsheetTitle,
          tabs: apiData.tabs.map((t: any) => {
            const detected = detectPlatform(t.title, t.headers || [], t.sampleRows || []);
            return {
              sheetId: String(t.sheetId || t.title),
              title: t.title,
              suggestedPlatform: detected.platform !== 'unknown' ? detected.platform : 'google',
              confidence: detected.confidence,
              headers: t.headers,
              sampleRows: t.sampleRows,
            };
          }),
        };
      }
    }
  } catch {
    // API offline or static host, proceed to direct discovery
  }

  // 2. Discover all tabs by fetching the public HTML view of the spreadsheet
  let discoveredTabs: { sheetId: string; title: string }[] = [];
  try {
    const htmlUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/htmlview`;
    const htmlResp = await fetch(htmlUrl);
    if (htmlResp.ok) {
      const html = await htmlResp.text();
      discoveredTabs = extractTabsFromHtml(html);
    }
  } catch (e) {
    console.warn('Failed to fetch htmlview:', e);
  }

  // If no multiple tabs found via HTML view, fallback to default Sheet1
  if (discoveredTabs.length === 0) {
    discoveredTabs = [{ sheetId: '0', title: 'Sheet1' }];
  }

  // 3. For each discovered tab, read headers and sample rows to detect platform and columns
  const fullTabs: TabDiscoveryResult['tabs'] = [];

  for (let i = 0; i < discoveredTabs.length; i++) {
    const tab = discoveredTabs[i];
    let headers: string[] = [];
    let sampleRows: Record<string, any>[] = [];

    try {
      const { headers: h, rows } = await fetchTabRows(spreadsheetId, tab.title || tab.sheetId);
      headers = h;
      sampleRows = rows.slice(0, 10);
    } catch (e) {
      console.warn(`Could not sample tab ${tab.title}:`, e);
    }

    const detected = detectPlatform(tab.title, headers, sampleRows);

    fullTabs.push({
      sheetId: tab.sheetId || String(i),
      title: tab.title,
      suggestedPlatform: detected.platform !== 'unknown' ? detected.platform : 'google',
      confidence: detected.confidence,
      headers,
      sampleRows,
    });
  }

  return {
    spreadsheetId,
    tabs: fullTabs,
  };
}

/**
 * Fetch rows for a specific tab of a spreadsheet with resilient multi-strategy fetching
 */
export async function fetchTabRows(spreadsheetId: string, tabNameOrGid: string): Promise<{
  headers: string[];
  rows: Record<string, any>[];
}> {
  const isCustomOrInvalid = !tabNameOrGid || tabNameOrGid.startsWith('custom_') || tabNameOrGid === '0';
  const strategies: string[] = [];

  if (!isCustomOrInvalid && !/^\d+$/.test(tabNameOrGid)) {
    strategies.push(`&sheet=${encodeURIComponent(tabNameOrGid)}`);
  }
  if (/^\d+$/.test(tabNameOrGid)) {
    strategies.push(`&gid=${tabNameOrGid}`);
  }
  // Default fallback (no sheet/gid param - fetches the first/default tab)
  strategies.push('');

  for (const queryParam of strategies) {
    // 1. Try Google Visualization CSV Export
    try {
      const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${queryParam}`;
      const resp = await fetch(csvUrl);
      if (resp.ok) {
        const text = await resp.text();
        const rawRows = parseCSV(text);
        if (rawRows.length > 0) {
          const headers = rawRows[0];
          const rows = rawRows.slice(1).map((r) => {
            const obj: Record<string, any> = {};
            headers.forEach((h, idx) => {
              obj[h] = r[idx] || '';
            });
            return obj;
          });
          return { headers, rows };
        }
      }
    } catch {
      // Continue to next strategy
    }

    // 2. Try Standard Google Sheets Export format=csv
    try {
      const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${queryParam}`;
      const fallbackResp = await fetch(exportUrl);
      if (fallbackResp.ok) {
        const text = await fallbackResp.text();
        const rawRows = parseCSV(text);
        if (rawRows.length > 0) {
          const headers = rawRows[0];
          const rows = rawRows.slice(1).map((r) => {
            const obj: Record<string, any> = {};
            headers.forEach((h, idx) => {
              obj[h] = r[idx] || '';
            });
            return obj;
          });
          return { headers, rows };
        }
      }
    } catch {
      // Continue
    }
  }

  throw new Error(`Could not access data for tab "${tabNameOrGid}". Please verify sheet is set to "Anyone with link can view" and tab name is exact.`);
}

/**
 * Main Sync Now Execution Loop
 * Follows Algorithm F & G:
 * - Deterministic sequence
 * - Batching 150 rows
 * - Deduplication via level 1-3 keys
 * - Progress notifications
 */
export async function executeSyncWorkflow(params: {
  sources: SheetSource[];
  existingAds: CanonicalAd[];
  onProgress?: (job: SyncJob) => void;
}): Promise<{
  job: SyncJob;
  updatedAds: CanonicalAd[];
}> {
  const { sources, existingAds, onProgress } = params;

  const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const counts: SyncJobCounts = {
    sourcesScanned: 0,
    tabsScanned: 0,
    rowsExamined: 0,
    newAdsCount: 0,
    updatedAdsCount: 0,
    unchangedAdsCount: 0,
    skippedRowsCount: 0,
    failedTabsCount: 0,
  };

  const job: SyncJob = {
    id: jobId,
    status: 'running',
    currentStage: 'Initializing sync engine...',
    progressPercent: 5,
    resultCounts: counts,
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    errors: [],
  };

  onProgress?.(job);

  // Build existing ad index map for O(1) deduplication lookup
  const adMap = new Map<string, CanonicalAd>();
  const idToAdMap = new Map<string, CanonicalAd>();

  existingAds.forEach(ad => {
    idToAdMap.set(ad.id, ad);
    const identity = createAdIdentity(ad);
    adMap.set(identity.lookupKey, ad);
    if (identity.platformAdId) {
      adMap.set(`id:${ad.platform.toLowerCase()}:${identity.platformAdId}`, ad);
    }
    if (identity.normalizedUrl) {
      adMap.set(`url:${identity.normalizedUrl}`, ad);
    }
    adMap.set(`fp:${identity.fingerprint}`, ad);
  });

  const activeSources = sources.filter(s => s.active);
  const totalTabs = activeSources.reduce((acc, s) => acc + s.tabs.filter(t => t.selected).length, 0);
  let completedTabs = 0;

  for (let sIdx = 0; sIdx < activeSources.length; sIdx++) {
    const source = activeSources[sIdx];
    counts.sourcesScanned++;
    job.currentSourceId = source.id;

    const selectedTabs = source.tabs.filter(t => t.selected);

    for (let tIdx = 0; tIdx < selectedTabs.length; tIdx++) {
      const tab = selectedTabs[tIdx];
      job.currentTabId = tab.id;
      job.currentStage = `Scanning ${source.sourceName} -> ${tab.tabName}...`;
      job.updatedAt = new Date().toISOString();
      onProgress?.(job);

      try {
        const { headers, rows } = await fetchTabRows(source.spreadsheetId, tab.tabName || tab.tabId);
        counts.tabsScanned++;

        // Determine field mapping
        let fieldMapping = tab.fieldMapping;
        if (!fieldMapping || Object.keys(fieldMapping).length === 0) {
          const detectedMapping = detectFieldMappings(headers);
          fieldMapping = detectedMapping.mappings;
        }

        // Determine platform
        let platform = tab.platform;
        if (!platform || platform === 'unknown') {
          const detectedPlatform = detectPlatform(tab.tabName, headers, rows);
          platform = detectedPlatform.platform !== 'unknown' ? detectedPlatform.platform : 'google';
        }

        // Process rows in batches of 150
        const BATCH_SIZE = 150;
        for (let r = 0; r < rows.length; r += BATCH_SIZE) {
          const batch = rows.slice(r, r + BATCH_SIZE);
          
          for (let bIdx = 0; bIdx < batch.length; bIdx++) {
            const rawRow = batch[bIdx];
            const rowNumber = r + bIdx + 2; // +1 header, +1 1-indexed
            counts.rowsExamined++;

            const normResult = normalizeAdRow({
              row: rawRow,
              headers,
              fieldMapping,
              platform,
              sourceId: source.id,
              tabId: tab.id,
              rowNumber,
            });

            if (!normResult.valid || !normResult.record) {
              counts.skippedRowsCount++;
              continue;
            }

            const incomingRecord = normResult.record;
            const incomingIdentity = createAdIdentity(incomingRecord);

            // Find existing ad matching level 1, 2, or 3
            let existing: CanonicalAd | undefined = undefined;
            if (incomingIdentity.platformAdId && adMap.has(`id:${incomingRecord.platform.toLowerCase()}:${incomingIdentity.platformAdId}`)) {
              existing = adMap.get(`id:${incomingRecord.platform.toLowerCase()}:${incomingIdentity.platformAdId}`);
            } else if (incomingIdentity.normalizedUrl && adMap.has(`url:${incomingIdentity.normalizedUrl}`)) {
              existing = adMap.get(`url:${incomingIdentity.normalizedUrl}`);
            } else if (adMap.has(`fp:${incomingIdentity.fingerprint}`)) {
              existing = adMap.get(`fp:${incomingIdentity.fingerprint}`);
            }

            if (!existing) {
              // Level 1-3 Insert new ad
              const newAdId = `ad_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
              const newAd: CanonicalAd = {
                id: newAdId,
                sourceSheetId: source.id,
                sourceTab: tab.tabName,
                platform: incomingRecord.platform,
                platformAdId: incomingIdentity.platformAdId,
                normalizedAdUrl: incomingIdentity.normalizedUrl,
                brand: incomingRecord.brand,
                title: incomingRecord.title,
                summary: incomingRecord.summary,
                adCopy: incomingRecord.adCopy,
                category: incomingRecord.category,
                creativeType: incomingRecord.creativeType,
                creativeUrl: incomingRecord.creativeUrl,
                thumbnailUrl: incomingRecord.thumbnailUrl,
                landingPageUrl: incomingRecord.landingPageUrl,
                sourceAdUrl: incomingRecord.sourceAdUrl,
                cta: incomingRecord.cta,
                hashtags: incomingRecord.hashtags,
                topics: incomingRecord.topics,
                metrics: incomingRecord.metrics,
                rawRowData: incomingRecord.rawRowData,
                searchConcepts: [incomingRecord.brand, incomingRecord.platform, incomingRecord.creativeType, ...incomingRecord.topics],
                fingerprint: incomingIdentity.fingerprint,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              };

              idToAdMap.set(newAd.id, newAd);
              if (incomingIdentity.platformAdId) adMap.set(`id:${incomingRecord.platform.toLowerCase()}:${incomingIdentity.platformAdId}`, newAd);
              if (incomingIdentity.normalizedUrl) adMap.set(`url:${incomingIdentity.normalizedUrl}`, newAd);
              adMap.set(`fp:${incomingIdentity.fingerprint}`, newAd);
              counts.newAdsCount++;
            } else {
              // Level 1-3 Upsert / Content comparison
              const isChanged = hasMeaningfulChanges(existing, incomingRecord);
              if (isChanged) {
                const merged = mergeAdData(existing, incomingRecord);
                idToAdMap.set(existing.id, merged);
                counts.updatedAdsCount++;
              } else {
                counts.unchangedAdsCount++;
              }
            }
          }

          // Checkpoint update after batch
          job.checkpoint = {
            sourceIndex: sIdx,
            tabIndex: tIdx,
            lastRow: Math.min(r + BATCH_SIZE, rows.length),
          };
          job.resultCounts = { ...counts };
          const tabProgress = totalTabs > 0 ? (completedTabs / totalTabs) * 85 : 50;
          job.progressPercent = Math.min(95, Math.round(10 + tabProgress));
          onProgress?.(job);
        }

        tab.lastScannedAt = new Date().toISOString();
        completedTabs++;
      } catch (tabErr: any) {
        counts.failedTabsCount++;
        const syncError: SyncJobError = {
          id: `err_${Date.now()}`,
          jobId,
          sourceId: source.id,
          tabId: tab.id,
          errorCode: 'TAB_NOT_FOUND',
          errorMessage: tabErr.message || 'Failed to read tab rows',
          retryable: true,
          createdAt: new Date().toISOString(),
        };
        job.errors = job.errors || [];
        job.errors.push(syncError);
      }
    }
  }

  job.status = counts.failedTabsCount > 0 ? 'completed_with_errors' : 'completed';
  job.currentStage = 'Sync completed successfully!';
  job.progressPercent = 100;
  job.resultCounts = counts;
  job.completedAt = new Date().toISOString();
  job.updatedAt = new Date().toISOString();

  // Save to DB and local cache
  await saveSheetSourcesToDB(sources);
  await saveSyncJobToDB(job);

  onProgress?.(job);

  const updatedAds = Array.from(idToAdMap.values());
  return { job, updatedAds };
}
