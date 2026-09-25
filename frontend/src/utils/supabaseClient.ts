/**
 * Supabase Database Client & Persistent Storage Adapter
 * Zero-Cost Free-Tier Safe (Supabase Free Tier)
 * Provides transparent fallback to preloaded JSON and localStorage when Supabase credentials are not yet set.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { CanonicalAd, SheetSource, SheetTabConfig, SyncJob } from '../types';

const SUPABASE_URL = ((import.meta as any).env?.VITE_SUPABASE_URL as string) || '';
const SUPABASE_ANON_KEY = ((import.meta as any).env?.VITE_SUPABASE_ANON_KEY as string) || '';

let supabase: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY) {
  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn('Supabase initialization failed, falling back to local storage:', err);
  }
}

export const isSupabaseConfigured = (): boolean => {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && supabase);
};

export const getSupabaseClient = (): SupabaseClient | null => supabase;

// ============================================================================
// Sheet Sources Persistent Storage Operations
// ============================================================================

const LOCAL_SOURCES_KEY = 'rankwatch_sheet_sources_v2';
const LOCAL_SYNC_HISTORY_KEY = 'rankwatch_sync_history_v2';

export async function fetchSheetSourcesFromDB(): Promise<SheetSource[]> {
  if (supabase) {
    try {
      const { data: sources, error } = await supabase
        .from('sheet_sources')
        .select(`
          id,
          workspace_id,
          spreadsheet_id,
          spreadsheet_url,
          source_name,
          active,
          created_at,
          updated_at,
          sheet_tabs (
            id,
            source_id,
            tab_id,
            tab_name,
            selected,
            platform,
            field_mapping,
            mapping_confidence,
            last_scanned_at
          )
        `)
        .order('created_at', { ascending: true });

      if (!error && sources && sources.length > 0) {
        return sources.map((s: any) => ({
          id: s.id,
          workspaceId: s.workspace_id,
          spreadsheetId: s.spreadsheet_id,
          spreadsheetUrl: s.spreadsheet_url,
          sourceName: s.source_name,
          active: s.active,
          status: 'active',
          tabs: (s.sheet_tabs || []).map((t: any) => ({
            id: t.id,
            sourceId: t.source_id,
            tabId: t.tab_id,
            tabName: t.tab_name,
            selected: t.selected,
            platform: t.platform,
            fieldMapping: t.field_mapping || {},
            mappingConfidence: Number(t.mapping_confidence) || 1.0,
            lastScannedAt: t.last_scanned_at,
          })),
        }));
      }
    } catch (err) {
      console.warn('Failed to query sheet_sources from Supabase:', err);
    }
  }

  // Fallback to localStorage
  try {
    const cached = localStorage.getItem(LOCAL_SOURCES_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch (e) {
    console.error('Failed to parse local sources:', e);
  }

  // Default initial sources
  const defaultSources: SheetSource[] = [
    {
      id: 'default-rankwatch-ads',
      spreadsheetId: '1B_m6K3T2U7_RANKWATCH_SOURCE_KEY',
      spreadsheetUrl: 'https://docs.google.com/spreadsheets/d/1B_m6K3T2U7/edit',
      sourceName: 'Rankwatch Ad Intelligence Main',
      active: true,
      status: 'active',
      tabs: [
        {
          id: 'tab-linkedin',
          sourceId: 'default-rankwatch-ads',
          tabId: 'linkedin',
          tabName: 'LinkedIn Ads',
          selected: true,
          platform: 'linkedin',
          fieldMapping: {},
          mappingConfidence: 1.0,
        },
        {
          id: 'tab-meta',
          sourceId: 'default-rankwatch-ads',
          tabId: 'meta',
          tabName: 'Meta & Instagram',
          selected: true,
          platform: 'meta',
          fieldMapping: {},
          mappingConfidence: 1.0,
        },
        {
          id: 'tab-google',
          sourceId: 'default-rankwatch-ads',
          tabId: 'google',
          tabName: 'Google Ads',
          selected: true,
          platform: 'google',
          fieldMapping: {},
          mappingConfidence: 1.0,
        },
      ],
    },
  ];
  return defaultSources;
}

export async function saveSheetSourcesToDB(sources: SheetSource[]): Promise<void> {
  // Always update local cache
  try {
    localStorage.setItem(LOCAL_SOURCES_KEY, JSON.stringify(sources));
  } catch (e) {
    console.error('Failed to write local sources cache:', e);
  }

  if (supabase) {
    try {
      for (const s of sources) {
        // Upsert sheet_sources
        await supabase.from('sheet_sources').upsert(
          {
            id: s.id.includes('-') && s.id.length === 36 ? s.id : undefined,
            spreadsheet_id: s.spreadsheetId,
            spreadsheet_url: s.spreadsheetUrl,
            source_name: s.sourceName,
            active: s.active,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'spreadsheet_id' }
        );

        // Upsert tabs
        for (const t of s.tabs) {
          await supabase.from('sheet_tabs').upsert(
            {
              source_id: s.id,
              tab_id: t.tabId,
              tab_name: t.tabName,
              selected: t.selected,
              platform: t.platform,
              field_mapping: t.fieldMapping,
              mapping_confidence: t.mappingConfidence,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'source_id, tab_id' }
          );
        }
      }
    } catch (err) {
      console.warn('Failed to upsert sheet_sources to Supabase:', err);
    }
  }
}

// ============================================================================
// Sync Jobs History
// ============================================================================

export async function saveSyncJobToDB(job: SyncJob): Promise<void> {
  try {
    const history = JSON.parse(localStorage.getItem(LOCAL_SYNC_HISTORY_KEY) || '[]');
    const existingIdx = history.findIndex((j: SyncJob) => j.id === job.id);
    if (existingIdx >= 0) {
      history[existingIdx] = job;
    } else {
      history.unshift(job);
    }
    localStorage.setItem(LOCAL_SYNC_HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch (e) {
    console.error('Failed to save sync job locally:', e);
  }

  if (supabase) {
    try {
      await supabase.from('sync_jobs').upsert({
        id: job.id,
        status: job.status,
        current_source_id: job.currentSourceId,
        current_tab_id: job.currentTabId,
        checkpoint: job.checkpoint,
        result_counts: job.resultCounts,
        started_at: job.startedAt,
        updated_at: job.updatedAt,
        completed_at: job.completedAt,
      });
    } catch (err) {
      console.warn('Failed to persist sync job to Supabase:', err);
    }
  }
}

export async function fetchSyncHistory(): Promise<SyncJob[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('sync_jobs')
        .select('*')
        .order('started_at', { ascending: false })
        .limit(10);
      if (!error && data && data.length > 0) {
        return data.map((d: any) => ({
          id: d.id,
          workspaceId: d.workspace_id,
          status: d.status,
          currentSourceId: d.current_source_id,
          currentTabId: d.current_tab_id,
          checkpoint: d.checkpoint,
          resultCounts: d.result_counts,
          startedAt: d.started_at,
          updatedAt: d.updated_at,
          completedAt: d.completed_at,
          progressPercent: d.status === 'completed' ? 100 : 50,
        }));
      }
    } catch (err) {
      console.warn('Failed to query sync history from Supabase:', err);
    }
  }

  try {
    return JSON.parse(localStorage.getItem(LOCAL_SYNC_HISTORY_KEY) || '[]');
  } catch {
    return [];
  }
}
