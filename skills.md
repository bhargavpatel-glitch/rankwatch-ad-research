# Ad Library Intelligence — Engineering & Relevance Skills

This document serves as the **Single Source of Truth** for the architecture, data ingestion, search relevance engine, UI/UX system, and development rules for **Ad Library Intelligence**.

---

## 1. Product Mission & Philosophy

Ad Library Intelligence is an enterprise-grade advertising intelligence and creative discovery platform. It transforms raw advertising data from multiple connected Google Sheets into a high-performance, searchable, and intuitive Ad Intelligence Hub.

### Non-Negotiable Core Principle:
> **SEARCH RELEVANCE AND ACCURACY OVER EVERYTHING ELSE.**
> This is not a spreadsheet viewer or a naive keyword substring matcher. The system must understand user intent, surface high-confidence exact matches first, integrate semantic concept similarity, cleanly filter on dynamic dimensions, and explain why an ad matched.

---

## 2. System Architecture

The application is structured into decoupled, modular tiers:

```
┌──────────────────────────────────────────────────────────┐
│                   Frontend (React + Vite)                │
│  - Dark Theme Discovery Canvas (Pinterest + SaaS UX)     │
│  - Intelligent Search Bar (Suggestions, Debounce, Debug) │
│  - Dynamic Filter Bar (Chips, Multi-Select, Counters)    │
│  - Responsive Ad Grid & Creative Detail Experience       │
│  - Settings: Google Sheet Connect & Realtime Sync        │
└────────────────────────────┬─────────────────────────────┘
                             │ REST / JSON APIs
┌────────────────────────────▼─────────────────────────────┐
│                   Backend Service Layer                  │
│  - Ingestion Engine (Multi-tab Google Sheets & XLSX)     │
│  - Normalizer & Deduplicator (Canonical Ad Schema)       │
│  - Hybrid Search Engine (BM25 + Semantic Concepts)       │
│  - Query Understanding Pipeline (Intent, Entities)       │
│  - Dynamic Filter Aggregator                             │
│  - Synchronization Worker (Periodic & Manual)            │
└────────────────────────────┬─────────────────────────────┘
                             │ Local Persistence & In-Memory Index
┌────────────────────────────▼─────────────────────────────┐
│              Data Storage & Search Index                 │
│  - Canonical SQLite / JSON Document Store                │
│  - BM25 Inverted Index + Concept Graph Vector Embeddings │
│  - Change Detection Fingerprints                         │
└──────────────────────────────────────────────────────────┘
```

---

## 3. Search Relevance & Information Retrieval Rules

### 3.1 Hybrid Scoring Formula
Every candidate advertisement receives a deterministically computed score:

$$\text{Final Score} = S_{\text{exact}} + S_{\text{phrase}} + S_{\text{brand}} + S_{\text{field\_weighted}} + S_{\text{semantic}} + S_{\text{feature}} + S_{\text{hashtag}} + S_{\text{category}} + S_{\text{platform}}$$

- **Exact Match Boost (Weight: 50.0)**: Direct exact phrase or brand match ranks at the top.
- **Brand Match Boost (Weight: 40.0)**: When query targets an advertiser (e.g. `Canva`, `Semrush`, `Peec AI`), ads from that brand receive immense priority.
- **Title / Headline Match (Weight: 25.0)**: High relevance signal.
- **Ad Copy / Summary / Caption Match (Weight: 15.0)**: High contextual signal.
- **Semantic / Concept Similarity (Weight: 20.0)**: Natural language matching using concept graphs and cosine semantic vectors.
- **Keywords / Topics / Features Match (Weight: 15.0)**: Match against extracted marketing features, AI tags, and domain topics.
- **Category & Platform Match (Weight: 10.0)**: Alignment on taxonomy.
- **Hashtag Match (Weight: 8.0)**: Exact hashtag relevance.
- **Low-value Metadata Penalty**: Raw IDs, URLs, and internal logs are weighted minimally (< 1.0) so they never dominate search.

### 3.2 Query Understanding Pipeline
Before query execution, every user input passes through:
1. **Normalization**: Lowercase, strip punctuation, collapse whitespace, unify hyphens (e.g., `ai-video` $\rightarrow$ `ai video`), singularize plurals (`ads` $\rightarrow$ `ad`, `tools` $\rightarrow$ `tool`).
2. **Intent Classification**: Detect if the query is Brand-seeking (`Semrush`), Platform-seeking (`Meta`, `Instagram`), Format-seeking (`Reel`, `Carousel`, `Video`), or Concept/Feature-seeking (`SEO`, `GEO`, `AEO`, `AI marketing agent`, `UGC hook`).
3. **Compound Term Preservation**: Do not split phrases into disjoint tokens where contextual meaning is lost. `AI video editing` requires conjunction of AI + video + editing concepts, not merely matching any document containing `AI`.
4. **Synonym & Concept Expansion**:
   - `AEO` / `GEO` $\leftrightarrow$ `Answer Engine Optimization`, `Generative Engine Optimization`, `AI Search`, `ChatGPT citations`
   - `Lead Gen` $\leftrightarrow$ `Lead Generation`, `Whitepaper`, `Case Study`
   - `Video Tool` $\leftrightarrow$ `Video Generator`, `Reel`, `Motion Ad`, `Video Editor`

### 3.3 Strict Relevance Guardrails
- **No Hallucinations**: Only surface data grounded in actual ad metadata.
- **Confidence Thresholding**: Results below a minimum relevance floor are filtered out.
- **Zero Results State**: If confidence is insufficient, gracefully show a high-end Zero Results view with helpful suggestions, rather than displaying irrelevant clutter.
- **Explainable Relevance**: Every search result MUST compute and expose an internal `matchExplanation`:
  ```json
  {
    "matchedFields": ["headline", "brand", "concepts"],
    "scoreBreakdown": { "exact": 0, "brand": 40.0, "semantic": 18.5, "field": 22.0 },
    "finalScore": 80.5,
    "highlightTerms": ["Semrush", "AI search"]
  }
  ```

---

## 4. Google Sheet Data Ingestion & Schema Rules

### 4.1 Multi-Tab Ingestion & Formula Extraction
The system connects to Google Sheets via public export and gviz protocols:
1. **Dynamic Tab Discovery**: Do not assume fixed sheet names. Detect tabs dynamically (e.g. `Google Ads`, `Meta Ads`, `Insta reel research`, `Linkedin ad research`).
2. **Hyperlink Formula Handling**: Extract both URLs and labels from `=HYPERLINK("https://...", "Label")` cells in XLSX/XML streams to retrieve creative assets (images, MP4s) and landing page URLs.
3. **Column Inference Engine**: Map source headers to canonical fields using fuzzy synonyms:
   - *Brand*: `['Advertiser', 'Company', 'Brand', 'Advertiser / Brand', 'Advertiser / Account', 'Paid For By']`
   - *Headline / Title*: `['Ad Headline', 'Title / Hook', 'Title', 'Headline']`
   - *Description / Summary*: `['Ad Summary', 'Primary Ad Text / Caption', 'Caption', 'What the Reel Is About', 'Reel Content Summary']`
   - *Platform*: Inferred from tab name or column (`Google Ads`, `Meta Ads`, `Instagram`, `LinkedIn`)
   - *Creative URL*: `['Image / Video / Creative Link', 'Creative URL', 'Image', 'Video']`
   - *Ad / Post URL*: `['Ad / Landing Page Link', 'Ad Link', 'Reel Link', 'Meta Ad Library Link', 'Source / Google Ads Transparency Link']`
   - *Format / Creative Type*: `['Ad Format', 'Creative Type', 'Content Type']`
   - *Keywords & Topics*: `['Keywords / Topics', 'Key Topics', 'Category of Ad', 'Category']`
   - *Engagement Metrics*: `['Views', 'Likes', 'Comments']`
   - *Dates*: `['Additional Ad Details', 'Date', 'Ran from ...']`
4. **Deduplication & Change Detection**:
   - Generate SHA-256 fingerprint from `(platform, brand, normalized_title, normalized_url, normalized_copy)`.
   - Track `NEW`, `UPDATED`, `UNCHANGED`, and `DELETED` records on every sync.

---

## 5. Canonical Ad Schema (TypeScript Interface)

```typescript
export interface CanonicalAd {
  id: string;                      // Stable deterministic hash
  sourceSheetId: string;           // Google Sheet Document ID
  sourceTab: string;               // Tab Name (e.g., 'Linkedin ad research')
  platform: 'Google Ads' | 'Meta Ads' | 'Instagram' | 'LinkedIn' | 'TikTok' | 'YouTube' | string;
  brand: string;                   // Normalized Brand Name
  advertiserRaw: string;           // Original raw advertiser string
  title: string;                   // Headline or hook
  summary: string;                 // Concise summary or extracted hook
  adCopy: string;                  // Full ad body / caption text
  category: string;                // Primary Category
  subcategory?: string;            // Secondary taxonomy
  creativeType: string;            // 'Single Image Ad' | 'Document Ad' | 'Video' | 'Carousel' | 'Reel'
  creativeUrl?: string;            // Direct creative preview (image, video)
  thumbnailUrl?: string;           // Computed or fallback thumbnail
  landingPageUrl?: string;         // Advertiser target landing page
  sourceAdUrl?: string;            // Transparency link / Meta / LinkedIn Library link
  cta?: string;                    // 'Learn more', 'Sign Up', etc.
  hashtags: string[];              // Extracted tags
  topics: string[];                // Domain keywords (e.g., 'SEO', 'GEO', 'AEO')
  metrics?: {                      // Engagement if available
    views?: string | number;
    likes?: string | number;
    comments?: string | number;
  };
  additionalDetails?: string;      // Date ran, notes, etc.
  rawRowData: Record<string, any>; // Lossless raw row preservation
  
  // Search Metadata
  searchDocument: string;          // Weighted composite text for lexical search
  searchConcepts: string[];        // Extracted semantic concept keywords
  fingerprint: string;             // Hash for sync change detection
  createdAt: string;
  updatedAt: string;
}
```

---

## 6. UI / UX Design System Rules

- **Aesthetic**: Deep Charcoal Dark Mode (`#0a0b0e`, `#12141a`, `#1a1d26`, subtle borders `#262a36`). Modern accent color: Electric Indigo (`#6366f1` / `#4f46e5`) and Emerald for verification (`#10b981`).
- **Discovery Grid**: Responsive card grid (1 col mobile, 2 col tablet, 3-4 col desktop, 5-6 col ultrawide). Masonry-friendly card layout.
- **Ad Card Anatomy**:
  1. Creative visual preview with aspect-ratio preservation and fallback styling.
  2. Brand pill with logo/monogram & platform badge with authentic platform color indicator.
  3. Headline / Hook (bold, clamped to 2 lines).
  4. Ad copy snippet (readable, high contrast).
  5. Creative format badge & Category badge.
  6. Action bar: "Inspect Details", "Open Link", "Why it matched" tooltip.
- **Detail Experience**: Deep slide-over drawer / modal showing complete creative preview, full ad text, extracted keywords, full transparency links, and a **"Related Ads"** carousel based on cosine/concept similarity.
- **Search Debug Mode**: Toggleable developer inspector revealing parsed query tokens, detected intents, individual field scores, and ranking distribution.

---

## 7. Quality & Verification Standards

1. **Deterministic Quality Verification**: Search test suite must pass predefined queries (`AI search`, `AEO`, `Enterprise GEO`, `Profound`, `Semrush`, `Peec AI`, `Reel hook`, `Document Ad`).
2. **Zero Runtime Dependencies on External Paid Search APIs**: Fast local hybrid BM25 + vector concept similarity ensures 100% privacy, high speed (<10ms queries), and offline resilience.
3. **Lossless Ingestion**: No raw fields from Google Sheets are discarded; raw data is preserved inside `rawRowData`.
4. **Type-Safe Codebase**: 100% strict TypeScript across frontend and backend.
