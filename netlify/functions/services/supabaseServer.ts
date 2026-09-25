/**
 * Server-Side Supabase Client & Database Services
 * Executes in Netlify Functions backend with service-role security.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  if (SUPABASE_URL && SUPABASE_KEY) {
    try {
      supabaseInstance = createClient(SUPABASE_URL, SUPABASE_KEY, {
        auth: { persistSession: false },
      });
      return supabaseInstance;
    } catch (e) {
      console.error('Failed to init Supabase server client:', e);
    }
  }
  return null;
}

export function isRemoteDBConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

export interface DBSheetSource {
  id: string;
  workspace_id?: string;
  spreadsheet_id: string;
  spreadsheet_url: string;
  source_name: string;
  active: boolean;
  tabs?: DBSheetTab[];
  created_at?: string;
  updated_at?: string;
}

export interface DBSheetTab {
  id: string;
  source_id: string;
  tab_id: string;
  tab_name: string;
  selected: boolean;
  platform: string;
  field_mapping: Record<string, string>;
  mapping_confidence: number;
  last_scanned_at?: string;
}

export async function fetchSourcesFromSupabase(): Promise<DBSheetSource[]> {
  const sb = getSupabaseServer();
  if (!sb) return [];

  const { data, error } = await sb
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

  if (error) {
    console.error('Error fetching sheet_sources from Supabase:', error);
    return [];
  }

  return (data || []).map((s: any) => ({
    id: s.id,
    workspace_id: s.workspace_id,
    spreadsheet_id: s.spreadsheet_id,
    spreadsheet_url: s.spreadsheet_url,
    source_name: s.source_name,
    active: s.active,
    tabs: (s.sheet_tabs || []).map((t: any) => ({
      id: t.id,
      source_id: t.source_id,
      tab_id: t.tab_id,
      tab_name: t.tab_name,
      selected: t.selected,
      platform: t.platform,
      field_mapping: t.field_mapping || {},
      mapping_confidence: Number(t.mapping_confidence) || 1.0,
      last_scanned_at: t.last_scanned_at,
    })),
  }));
}

export async function upsertSourceInSupabase(source: DBSheetSource): Promise<boolean> {
  const sb = getSupabaseServer();
  if (!sb) return false;

  const { data, error } = await sb
    .from('sheet_sources')
    .upsert(
      {
        spreadsheet_id: source.spreadsheet_id,
        spreadsheet_url: source.spreadsheet_url,
        source_name: source.source_name,
        active: source.active ?? true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'spreadsheet_id' }
    )
    .select()
    .single();

  if (error || !data) {
    console.error('Error saving sheet_source:', error);
    return false;
  }

  if (source.tabs && source.tabs.length > 0) {
    for (const t of source.tabs) {
      await sb.from('sheet_tabs').upsert(
        {
          source_id: data.id,
          tab_id: t.tab_id,
          tab_name: t.tab_name,
          selected: t.selected ?? true,
          platform: t.platform || 'unknown',
          field_mapping: t.field_mapping || {},
          mapping_confidence: t.mapping_confidence || 1.0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'source_id, tab_id' }
      );
    }
  }

  return true;
}

export async function fetchAdsFromSupabase(params: {
  q?: string;
  brands?: string[];
  platforms?: string[];
  creativeTypes?: string[];
  categories?: string[];
  sources?: string[];
  tabs?: string[];
  sort?: string;
  page?: number;
  limit?: number;
}): Promise<{ ads: any[]; total: number }> {
  const sb = getSupabaseServer();
  if (!sb) return { ads: [], total: 0 };

  let query = sb.from('ads').select('*', { count: 'exact' });

  if (params.brands && params.brands.length > 0) {
    query = query.in('brand', params.brands);
  }
  if (params.platforms && params.platforms.length > 0) {
    query = query.in('platform', params.platforms);
  }
  if (params.creativeTypes && params.creativeTypes.length > 0) {
    query = query.in('creative_type', params.creativeTypes);
  }
  if (params.categories && params.categories.length > 0) {
    query = query.in('category', params.categories);
  }

  if (params.q) {
    const cleanQ = params.q.trim();
    query = query.or(`title.ilike.%${cleanQ}%,ad_copy.ilike.%${cleanQ}%,brand.ilike.%${cleanQ}%`);
  }

  if (params.sort === 'newest') {
    query = query.order('created_at', { ascending: false });
  } else if (params.sort === 'oldest') {
    query = query.order('created_at', { ascending: true });
  } else if (params.sort === 'brand_asc') {
    query = query.order('brand', { ascending: true });
  } else if (params.sort === 'brand_desc') {
    query = query.order('brand', { ascending: false });
  } else {
    query = query.order('updated_at', { ascending: false });
  }

  const page = params.page || 1;
  const limit = params.limit || 40;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  query = query.range(from, to);

  const { data, count, error } = await query;
  if (error) {
    console.error('Error querying ads from Supabase:', error);
    return { ads: [], total: 0 };
  }

  const formattedAds = (data || []).map((a: any) => ({
    id: a.id,
    sourceSheetId: a.source_sheet_id || '',
    sourceTab: a.source_tab || '',
    platform: a.platform,
    platformAdId: a.platform_ad_id,
    normalizedAdUrl: a.normalized_ad_url,
    brand: a.brand,
    title: a.title,
    summary: a.summary,
    adCopy: a.ad_copy,
    category: a.category || 'General',
    creativeType: a.creative_type || 'Single Image Ad',
    creativeUrl: a.creative_url,
    thumbnailUrl: a.thumbnail_url,
    landingPageUrl: a.landing_page_url,
    sourceAdUrl: a.source_ad_url,
    cta: a.cta,
    hashtags: a.canonical_fields?.hashtags || [],
    topics: a.canonical_fields?.topics || [],
    metrics: a.metrics || {},
    rawRowData: a.raw_data || {},
    searchConcepts: a.canonical_fields?.searchConcepts || [a.brand, a.platform],
    fingerprint: a.content_fingerprint,
    createdAt: a.created_at,
    updatedAt: a.updated_at,
  }));

  return { ads: formattedAds, total: count || 0 };
}
