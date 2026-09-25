-- ============================================================================
-- Rankwatch Ad: Shared Persistent Storage & Sync Schema
-- Architecture & Algorithm Reference: ADDITIONAL REQUIREMENT.md
-- Zero-Cost Free-tier Safe (Supabase Free + Netlify Free)
-- ============================================================================

-- 1. Workspaces
CREATE TABLE IF NOT EXISTS workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Default Initial Workspace
INSERT INTO workspaces (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'Rankwatch Ad Intelligence')
ON CONFLICT (id) DO NOTHING;

-- 2. Profiles (Teammates)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Workspace Members
CREATE TABLE IF NOT EXISTS workspace_members (
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    PRIMARY KEY (workspace_id, user_id)
);

-- 4. Sheet Sources
CREATE TABLE IF NOT EXISTS sheet_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    spreadsheet_id TEXT NOT NULL,
    spreadsheet_url TEXT NOT NULL,
    source_name TEXT NOT NULL,
    active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_workspace_spreadsheet UNIQUE (workspace_id, spreadsheet_id)
);

-- 5. Sheet Tabs
CREATE TABLE IF NOT EXISTS sheet_tabs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID REFERENCES sheet_sources(id) ON DELETE CASCADE,
    tab_id TEXT NOT NULL,
    tab_name TEXT NOT NULL,
    selected BOOLEAN NOT NULL DEFAULT true,
    platform TEXT NOT NULL DEFAULT 'unknown',
    field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
    mapping_confidence NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    last_scanned_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_source_tab UNIQUE (source_id, tab_id)
);

-- 6. Canonical Ads Table
CREATE TABLE IF NOT EXISTS ads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    platform TEXT NOT NULL,
    platform_ad_id TEXT,
    normalized_ad_url TEXT,
    content_fingerprint TEXT NOT NULL,
    brand TEXT NOT NULL DEFAULT 'Unknown Brand',
    title TEXT,
    summary TEXT,
    ad_copy TEXT,
    category TEXT DEFAULT 'General',
    creative_type TEXT DEFAULT 'Single Image Ad',
    creative_url TEXT,
    thumbnail_url TEXT,
    landing_page_url TEXT,
    source_ad_url TEXT,
    cta TEXT,
    metrics JSONB DEFAULT '{}'::jsonb,
    canonical_fields JSONB NOT NULL DEFAULT '{}'::jsonb,
    raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Ad Sources Association (Many-to-Many traceability)
CREATE TABLE IF NOT EXISTS ad_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ad_id UUID REFERENCES ads(id) ON DELETE CASCADE,
    source_id UUID REFERENCES sheet_sources(id) ON DELETE CASCADE,
    tab_id TEXT NOT NULL,
    row_number INT NOT NULL,
    source_row_hash TEXT,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT unique_ad_source_tab_row UNIQUE (ad_id, source_id, tab_id, row_number)
);

-- 8. Persistent Sync Jobs
CREATE TABLE IF NOT EXISTS sync_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE DEFAULT '00000000-0000-0000-0000-000000000001',
    initiated_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'paused', 'completed', 'completed_with_errors', 'failed', 'cancelled')),
    current_source_id UUID REFERENCES sheet_sources(id) ON DELETE SET NULL,
    current_tab_id TEXT,
    checkpoint JSONB DEFAULT '{}'::jsonb,
    result_counts JSONB NOT NULL DEFAULT '{
        "sourcesScanned": 0,
        "tabsScanned": 0,
        "rowsExamined": 0,
        "newAdsCount": 0,
        "updatedAdsCount": 0,
        "unchangedAdsCount": 0,
        "skippedRowsCount": 0,
        "failedTabsCount": 0
    }'::jsonb,
    started_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    completed_at TIMESTAMPTZ
);

-- 9. Sync Errors Log
CREATE TABLE IF NOT EXISTS sync_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES sync_jobs(id) ON DELETE CASCADE,
    source_id UUID REFERENCES sheet_sources(id) ON DELETE SET NULL,
    tab_id TEXT,
    row_number INT,
    error_code TEXT NOT NULL CHECK (error_code IN (
        'INVALID_SOURCE_URL',
        'ACCESS_DENIED',
        'SPREADSHEET_NOT_FOUND',
        'TAB_NOT_FOUND',
        'GOOGLE_API_QUOTA',
        'GOOGLE_API_TEMPORARY_FAILURE',
        'INVALID_HEADER_MAPPING',
        'INVALID_ROW',
        'DATABASE_WRITE_FAILURE',
        'SYNC_LOCKED',
        'SYNC_TIMEOUT',
        'UNKNOWN_ERROR'
    )),
    error_message TEXT NOT NULL,
    retryable BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for maximum query performance & deduplication lookup
CREATE INDEX IF NOT EXISTS idx_sheet_sources_workspace ON sheet_sources(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sheet_tabs_source ON sheet_tabs(source_id);
CREATE INDEX IF NOT EXISTS idx_ads_workspace ON ads(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ads_platform ON ads(platform);
CREATE INDEX IF NOT EXISTS idx_ads_platform_ad_id ON ads(workspace_id, platform, platform_ad_id) WHERE platform_ad_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ads_normalized_url ON ads(workspace_id, normalized_ad_url) WHERE normalized_ad_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ads_fingerprint ON ads(workspace_id, content_fingerprint);
CREATE INDEX IF NOT EXISTS idx_ad_sources_ad_id ON ad_sources(ad_id);
CREATE INDEX IF NOT EXISTS idx_ad_sources_source ON ad_sources(source_id, tab_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_workspace_status ON sync_jobs(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_sync_errors_job ON sync_errors(job_id);

-- Row Level Security (RLS)
ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sheet_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ads ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sync_errors ENABLE ROW LEVEL SECURITY;

-- Default Team Workspace Policies (Allows authorized team members to read & write shared workspace data)
CREATE POLICY "Allow team read access for workspaces" ON workspaces FOR SELECT USING (true);
CREATE POLICY "Allow team read access for sheet_sources" ON sheet_sources FOR SELECT USING (true);
CREATE POLICY "Allow team read access for sheet_tabs" ON sheet_tabs FOR SELECT USING (true);
CREATE POLICY "Allow team read access for ads" ON ads FOR SELECT USING (true);
CREATE POLICY "Allow team read access for ad_sources" ON ad_sources FOR SELECT USING (true);
CREATE POLICY "Allow team read access for sync_jobs" ON sync_jobs FOR SELECT USING (true);
CREATE POLICY "Allow team insert/update for sync_jobs" ON sync_jobs FOR ALL USING (true);
CREATE POLICY "Allow team insert/update for sheet_sources" ON sheet_sources FOR ALL USING (true);
CREATE POLICY "Allow team insert/update for sheet_tabs" ON sheet_tabs FOR ALL USING (true);
CREATE POLICY "Allow team insert/update for ads" ON ads FOR ALL USING (true);
CREATE POLICY "Allow team insert/update for ad_sources" ON ad_sources FOR ALL USING (true);
CREATE POLICY "Allow team insert/update for sync_errors" ON sync_errors FOR ALL USING (true);
