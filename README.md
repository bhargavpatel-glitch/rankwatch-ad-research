# ⚡ Ad Library Intelligence

A production-quality advertising intelligence platform that transforms multi-tab Google Sheets into a fast, searchable, and intelligent Ad Library. Powered by a **hybrid information retrieval engine (BM25 lexical + semantic concepts + exact boosts)**, dynamic filters, live change-detection sync, and a modern dark SaaS UI.

---

## 🚀 Key Highlights & Capabilities

- **Intelligent Hybrid Search**:
  - **BM25 Inverted Index** with field-weighted relevance (Title: 25, Brand: 45, Topics: 16, Copy: 14, Platform: 8).
  - **Exact Match Priority**: Verbatim brand and phrase matches receive prominent boosts (+50.0).
  - **Semantic Concept Vectors**: Matches marketing intent beyond exact keywords (`AEO` $\leftrightarrow$ `Answer Engine Optimization`, `GEO` $\leftrightarrow$ `Generative Engine Optimization`, `Autonomous AI` $\leftrightarrow$ `background marketing agent`).
  - **Multi-Word Query Conjunction**: Prevents single-word false positive spam (e.g. searching `"AI video editing"` requires joint relevance, not returning every ad with `"AI"`).
  - **Explainable Relevance Inspector**: Developer debug mode displays matched tokens, intent classification, and exact scoring breakdowns.
- **Dynamic Multi-Tab Ingestion**:
  - Automatically parses all tabs from Google Sheets (detected tabs: **Google Ads**, **Meta Ads**, **Insta reel research**, **Linkedin ad research**).
  - Ingested **8,285 real advertisements** with 0 data loss.
  - Resolves `=HYPERLINK(...)` formulas to extract direct image/video preview CDN URLs (`licdn.com`, `instagram.com`).
- **Dynamic Filter Aggregation**:
  - Filter by **Brand** (multi-select with live search), **Platform**, **Creative Type**, **Category**, and **Sort**.
  - Live counts updated on the fly.
- **Deep Creative Inspection & Related Ads**:
  - Slide-over drawer with media player/preview, full copy, topics, hashtags, and **Related Ads recommendations** powered by cosine concept similarity.
- **Live Google Sheet Synchronization**:
  - Background sync worker (every 5 minutes) + instant "Sync Now" button.
  - Fingerprint-based change detection (`NEW`, `UPDATED`, `UNCHANGED`, `DELETED`).
  - "Add Google Sheet" modal with live 8-step processing progress bar.

---

## 🛠️ Project Structure

```
rw-research-search-tool/
├── backend/
│   ├── src/
│   │   ├── config.ts                 # Port, paths, and default sheet settings
│   │   ├── types.ts                  # Canonical Ad schema & search types
│   │   ├── ingestion/
│   │   │   └── ingest_sheets.py      # High-performance multi-tab XLSX & formula extractor
│   │   ├── search/
│   │   │   ├── queryPipeline.ts      # Query normalization, intent & concept extractor
│   │   │   ├── hybridSearchEngine.ts # BM25 + semantic concept scorer & reranker
│   │   │   └── testRelevance.ts      # Automated search relevance test suite
│   │   ├── services/
│   │   │   ├── adStore.ts            # Fast memory-mapped ad database & filter aggregator
│   │   │   ├── syncService.ts        # Background & manual sync scheduler
│   │   │   └── dataSourceService.ts  # Multi-sheet management
│   │   ├── routes/
│   │   │   ├── adsRouter.ts          # /api/ads, /api/ads/search, /api/ads/:id/similar
│   │   │   ├── filtersRouter.ts      # /api/filters
│   │   │   ├── syncRouter.ts         # /api/sync/status, /api/sync/trigger
│   │   │   └── dataSourcesRouter.ts  # /api/data-sources
│   │   └── server.ts                 # Express HTTP server
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Header.tsx            # Search bar with suggestions, debug toggle, sync button
│   │   │   ├── Sidebar.tsx           # Navigation & dataset statistics
│   │   │   ├── FilterBar.tsx         # Brand search, platform, format filters & active chips
│   │   │   ├── AdCard.tsx            # Visual card with media preview, platform pill, badges
│   │   │   ├── AdGrid.tsx            # Responsive grid with skeleton loading
│   │   │   ├── AdDetailDrawer.tsx    # Slide-over inspector with related ads
│   │   │   ├── SearchDebugModal.tsx  # Relevance inspector breakdown
│   │   │   ├── DataSourcesModal.tsx  # Add Google Sheet with 8-step progress
│   │   │   └── EmptyState.tsx        # Zero results state with recommendations
│   │   ├── App.tsx                   # Main layout and state coordinator
│   │   └── index.css                 # Dark obsidian styling
├── data/
│   └── ads.json                      # 8,285 canonical indexed advertisements
└── skills.md                         # Authoritative source of truth rules
```

---

## 🏃 Quickstart

### 1. Ingest Data from Google Sheets
```bash
python backend/src/ingestion/ingest_sheets.py
```

### 2. Run Search Relevance Benchmark Tests
```bash
cd backend
npm run test:search
```

### 3. Start Backend API Server
```bash
cd backend
npm run dev
# Starts API server on http://localhost:3001
```

### 4. Start Frontend Client
```bash
cd frontend
npm run dev
# Launches Vite dev server on http://localhost:5173
```

---

## 🧪 Verified Benchmark Queries

| Query | Key Tested Relevance Principle | Result |
|---|---|---|
| `"Semrush"` | Exact brand boost priority | Ranked #1 Semrush ads (+167 score) |
| `"Peec AI"` | Exact brand lookup | Ranked #1 Peec AI ads (+296 score) |
| `"AI search"` | Concept expansion (GEO/AEO/Answer engine) | Top result: OtterlyAI & Profound AI Search ads |
| `"AEO tracking"` | Domain topic + feature match | Top result: Peec AI AEO Tracking Pricing ad |
| `"Enterprise GEO"` | Multi-word conjunction (Enterprise + GEO) | Top result: Semrush Enterprise GEO ad |
| `"Document Ad"` | Format discovery for LinkedIn Carousels | Top result: Document carousel ads |
| `"Instagram reel"` | Platform + format discovery | Top result: Instagram Reels |
