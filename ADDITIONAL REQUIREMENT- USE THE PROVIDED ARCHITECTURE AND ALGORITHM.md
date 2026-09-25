# ADDITIONAL REQUIREMENT: USE THE PROVIDED ARCHITECTURE AND ALGORITHM

I have also attached:
1. A screenshot of the intended Sync Now algorithm flowchart.
2. An image of the intended system architecture.

**These images are part of the implementation specification. Study them before coding.** Use the provided flowchart to guide the synchronization sequence and use the architecture image to guide how the frontend, backend, Google Sheets and database interact.

Do not replace these diagrams with a completely different design without identifying a specific technical problem. If any detail is unclear or conflicts with the existing project, inspect the code and explain the discrepancy before proceeding.

I do not want you to invent a new synchronization algorithm from scratch. Implement the following prescribed algorithm and adapt it to the existing project.

---

# 1. PRESCRIBED SYSTEM ARCHITECTURE

Implement this data flow:

```text
EXISTING RANKWATCH AD FRONTEND
          |
          | User clicks Sync Now
          v
BACKEND API — NETLIFY FUNCTIONS
          |
          v
AUTHENTICATION AND PERMISSION CHECK
          |
          v
CREATE OR RESUME SYNC JOB
          |
          v
LOAD ALL ACTIVE SHEET SOURCES
          |
          v
FOR EACH SOURCE
          |
          v
LOAD SELECTED TABS
          |
          v
READ GOOGLE SHEETS METADATA AND ROWS
          |
          v
DETECT PLATFORM AND MAP COLUMNS
          |
          v
NORMALIZE AND VALIDATE RECORDS
          |
          v
GENERATE DEDUPLICATION KEYS
          |
          v
CHECK SHARED SUPABASE DATABASE
          |
          +--------------------------+
          |                          |
          v                          v
    NEW RECORD                 EXISTING RECORD
          |                          |
          v                          v
    INSERT AD                COMPARE CONTENT
                                     |
                          +----------+----------+
                          |                     |
                          v                     v
                     CHANGED                UNCHANGED
                          |                     |
                          v                     v
                       UPDATE                NO WRITE
                          |                     |
                          +----------+----------+
                                     |
                                     v
                           SAVE SOURCE MAPPING
                                     |
                                     v
                           UPDATE JOB CHECKPOINT
                                     |
                                     v
                           PROCESS NEXT BATCH
                                     |
                                     v
                         ALL SELECTED TABS DONE?
                                     |
                                     v
                          SAVE FINAL JOB REPORT
                                     |
                                     v
                         NOTIFY ALL TEAM MEMBERS
```

This is the required logical workflow. The implementation may use smaller functions and database transactions, but it must preserve this sequence and its data integrity guarantees.

---

# 2. ALGORITHM A: REGISTERING A NEW GOOGLE SHEETS SOURCE

Implement the following exact process when a user adds a spreadsheet.

## Input

A user supplies:
- Google Sheets URL
- Optional source name
- Spreadsheet access through the configured Google service account

## Algorithm

```typescript
async function registerSheetSource(input) {
    // 1. Validate the input.
    const spreadsheetId = extractSpreadsheetId(input.url);

    if (!spreadsheetId) {
        return {
            success: false,
            error: "Invalid Google Sheets URL"
        };
    }

    // 2. Check whether the spreadsheet is already registered.
    const existing = await findExistingSource(
        input.workspaceId,
        spreadsheetId
    );

    if (existing) {
        return {
            success: false,
            error: "This spreadsheet is already registered"
        };
    }

    // 3. Retrieve spreadsheet metadata.
    const spreadsheet = await getSpreadsheetMetadata(
        spreadsheetId
    );

    // 4. Discover every available tab.
    const tabs = spreadsheet.sheets.map(sheet => ({
        sheetId: sheet.properties.sheetId,
        title: sheet.properties.title
    }));

    // 5. Save the source and its discovered tabs.
    const source = await createSource({
        spreadsheetId,
        url: input.url,
        name: input.name,
        status: "pending_selection"
    });

    await saveDiscoveredTabs(source.id, tabs);

    // 6. Return the tab-selection interface data.
    return {
        success: true,
        sourceId: source.id,
        tabs
    };
}
```

This is pseudocode describing the required behavior, not a demand to copy the exact function names or types.

The actual implementation must use the existing project's conventions and the real Google Sheets API response structure.

## User selection

After discovering tabs, show a selection interface with:
- Select all
- Individual checkboxes
- Save selection
- Preview detected data

Save each tab's selection state in the database.

A source can have some tabs enabled and others disabled. The Sync Now algorithm must only scan enabled tabs.

When a new tab is discovered on a later sync, add it to the source's tab list and show that it is new. Do not silently include it in an existing scan if the user previously chose specific tabs.

If the user originally selected all tabs, newly discovered tabs may be automatically selected, but clearly record this behavior and make it configurable.

---

# 3. ALGORITHM B: COLUMN DETECTION AND FIELD MAPPING

Create a deterministic, reusable mapping engine.

Do not use an AI API or ask a language model to interpret every spreadsheet during synchronization.

The detection process should use the following order:

1. Normalize the header names.
2. Match normalized headers against the alias dictionary.
3. Inspect the tab name for platform clues.
4. Inspect relevant cell values for data types and known URL domains.
5. Assign confidence to each detected field and platform.
6. Flag uncertain or conflicting results for user confirmation.

## Header normalization

Implement:

```typescript
function normalizeHeader(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "");
}
```

Examples:

```text
"Ad Link"              -> "ad_link"
"AD LINK"              -> "ad_link"
"Primary Ad Text"      -> "primary_ad_text"
"Keywords / Topic"     -> "keywords_topic"
"Published Date"       -> "published_date"
"Views"                -> "views"
```

Use this function consistently when comparing source headers.

## Canonical field aliases

Create a central configuration file rather than scattering header comparisons across components.

```typescript
const FIELD_ALIASES = {
    company: [
        "company",
        "brand",
        "advertiser",
        "brand_name"
    ],

    ad_url: [
        "ad_link",
        "reel_link",
        "video_link",
        "post_url",
        "url",
        "creative_link"
    ],

    headline: [
        "ad_headline",
        "headline",
        "title",
        "hook",
        "video_hook"
    ],

    primary_text: [
        "primary_ad_text",
        "primary_text",
        "caption",
        "reel_content",
        "ad_copy"
    ],

    published_date: [
        "published_date",
        "post_date",
        "date",
        "publish_date"
    ],

    views: [
        "views",
        "video_views"
    ],

    likes: [
        "likes",
        "reactions"
    ],

    comments: [
        "comments",
        "comment_count"
    ],

    keywords: [
        "keywords",
        "key_topics",
        "target_search_keyword",
        "topics"
    ],

    creative_type: [
        "ad_format",
        "creative_type",
        "content_type"
    ],

    cta: [
        "cta",
        "call_to_action"
    ],

    transcript: [
        "transcript",
        "transcription"
    ]
};
```

Extend this configuration whenever a new source format is encountered.

Do not assume these aliases cover every possible spreadsheet. The mapping system must permit user-defined aliases and manual field mapping.

## Platform detection

Implement a deterministic scoring system.

For example:

```typescript
function detectPlatform(tabName, headers, sampleRows) {
    const evidence = {
        instagram: 0,
        linkedin: 0,
        facebook: 0,
        google: 0,
        youtube: 0
    };

    // Evaluate tab name.
    // Evaluate normalized headers.
    // Evaluate known URL domains.
    // Evaluate platform-specific identifiers.
    // Do not treat generic terms such as "video" as
    // conclusive platform evidence.

    return calculatePlatformConfidence(evidence);
}
```

The implementation must distinguish between:
- A detected platform with high confidence
- A suggested platform that requires confirmation
- An unknown platform

Do not classify a sheet solely because its tab name includes a platform name.

Store the detection method, confidence and any user override with the tab configuration.

---

# 4. ALGORITHM C: NORMALIZE AND VALIDATE EACH ROW

Every row must be converted to a consistent internal ad record before it is saved.

Use a function with a clear contract:

```typescript
function normalizeAdRow({
    row,
    headers,
    fieldMapping,
    platform,
    sourceId,
    tabId,
    rowNumber
}) {
    // Return either:
    // { valid: true, record: canonicalRecord }
    // or
    // { valid: false, errors: [...] }
}
```

## Normalization rules

1. Trim leading and trailing whitespace from strings.
2. Preserve the original values in `raw_data`.
3. Convert numeric engagement fields to appropriate numeric types when safely possible.
4. Convert empty cells to null, not the strings `"null"` or `"undefined"`.
5. Normalize dates only when the date is valid and its interpretation is unambiguous.
6. Preserve source URLs.
7. Do not construct, rewrite or guess missing creative URLs.
8. Do not discard extra columns that are not yet mapped.
9. Preserve row number and original header names for troubleshooting.

## Validation rules

A record must have enough information to identify or display it meaningfully.

Preferred required fields:
- An ad URL or platform-specific ad ID
- At least one useful descriptive field, such as company, headline, primary text or caption

If a record is missing both a usable identifier and meaningful descriptive information, skip it and record a validation error.

Do not reject an otherwise usable ad simply because views, likes, comments or a CTA are missing.

Do not make the validation overly strict. Different platforms and research sheets contain different kinds of records.

---

# 5. ALGORITHM D: DEDUPLICATION

Deduplication must be deterministic, safe and idempotent.

The same input spreadsheet must be importable repeatedly without creating duplicate ad records.

Implement the following matching hierarchy.

## Level 1: Platform-specific ad ID

If a reliable platform-specific ad ID exists, use it together with the workspace and platform as the primary identity.

Do not assume that a spreadsheet row number is a platform-specific ad ID.

## Level 2: Normalized ad URL

When a reliable ad ID is unavailable, use a normalized ad URL.

The URL normalization function must:
- Trim whitespace.
- Remove harmless trailing punctuation.
- Normalize the hostname and scheme.
- Remove known tracking parameters only when doing so cannot change the identity of the creative.
- Preserve meaningful path segments and identifiers.
- Avoid treating two distinct creatives as identical just because they share a generic landing page.

Do not strip all query parameters indiscriminately.

If a URL is ambiguous or cannot be normalized safely, continue to the fallback strategy rather than inventing an identity.

## Level 3: Stable content fingerprint

When neither an ad ID nor a reliable URL is available, create a fingerprint from suitable fields.

Example:

```typescript
const fingerprintInput = {
    platform,
    company: normalizeText(company),
    headline: normalizeText(headline),
    primaryText: normalizeText(primaryText),
    publishedDate: normalizeDate(publishedDate)
};
```

Hash a deterministic serialization of the selected fields.

Do not use random IDs or current timestamps as part of the fingerprint.

Do not use a headline alone as the fallback identity.

For records that are too incomplete to produce a reliable fingerprint, flag them for review instead of risking a false duplicate.

## Source association

Maintain a separate association between each ad and the source rows in which it appears.

An ad can have multiple sources.

When an ad is detected in a new source:
- Do not create a second ad record if the identity is reliable.
- Add the new source association.
- Preserve the original source association.
- Track the latest imported row information separately for each source.

This allows the team to trace an ad back to its source spreadsheet and tab.

---

# 6. ALGORITHM E: CONTENT COMPARISON AND UPSERT

After matching an incoming record against the database, determine whether it is new, changed or unchanged.

Implement this exact decision process:

```typescript
async function upsertAd(incoming, sourceContext) {
    const identity = createAdIdentity(incoming);

    if (!identity.reliable) {
        return recordForManualReview(incoming);
    }

    const existing = await findExistingAd(identity);

    if (!existing) {
        const inserted = await insertAd(incoming);

        await createSourceAssociation(
            inserted.id,
            sourceContext
        );

        return {
            action: "inserted",
            adId: inserted.id
        };
    }

    const merged = mergeAdData(existing, incoming);

    const changed = hasMeaningfulChanges(
        existing,
        merged
    );

    if (changed) {
        await updateAd(existing.id, merged);
    }

    await upsertSourceAssociation(
        existing.id,
        sourceContext
    );

    return {
        action: changed ? "updated" : "unchanged",
        adId: existing.id
    };
}
```

The actual implementation must use database transactions and appropriate unique constraints to prevent races.

## Merge policy

When merging records:
- A non-empty incoming value may replace an existing value when the source mapping is authoritative.
- A blank incoming cell must not erase a useful existing value.
- Existing manual corrections should not be overwritten by routine imports unless the system has an explicit, documented source-precedence policy.
- Preserve original raw source data separately from the normalized record.
- Update the record's modification timestamp only when meaningful data changes.

Avoid unnecessary writes to the database for unchanged records.

---

# 7. ALGORITHM F: SYNC NOW JOB LIFECYCLE

Use a persistent job state machine.

Supported statuses:

```text
queued
running
paused
completed
completed_with_errors
failed
cancelled
```

Each job must store:
- Unique job ID
- Workspace ID
- Initiating user ID
- Job status
- Start timestamp
- Last progress timestamp
- Completion timestamp
- Source and tab currently being processed
- Current batch checkpoint
- Total rows examined
- New records count
- Updated records count
- Unchanged records count
- Skipped rows count
- Failed tab count
- Error information

## Job creation

When Sync Now is clicked:

1. Check authentication and workspace access.
2. Check whether an active sync job already exists for the requested scope.
3. If one exists, return its status instead of creating an overlapping job.
4. Otherwise, create a new persistent job with status `queued`.
5. Return the job ID to the frontend.

The frontend must not create a second job just because the user refreshes the page or clicks the button repeatedly.

## Job execution

Process sources and tabs in a deterministic order.

For each source:
1. Retrieve the spreadsheet metadata.
2. Verify the source is accessible.
3. Retrieve its currently configured tabs.
4. Verify the selected tabs still exist.
5. Detect structural changes.
6. Read rows in batches.
7. Process each row through the normalization and deduplication functions.
8. Save the batch's results.
9. Save the checkpoint only after the batch has been successfully persisted.
10. Continue until all selected tabs are complete.

Do not advance a checkpoint before the corresponding data writes have succeeded.

If a batch fails:
- Record the failure.
- Do not mark its rows as completed.
- Preserve the last successful checkpoint.
- Retry only when safe.
- Avoid repeating successful inserts through idempotent matching.

## Batch execution

Use a configurable batch size, initially 100–200 rows.

Do not fetch an entire large spreadsheet into serverless memory if it can be processed incrementally.

Use efficient Google Sheets API reads and database bulk operations.

Respect Netlify Free execution limits.

Use a bounded number of rows and tabs per request, with persisted checkpoints and resumable continuation.

Do not rely on a single long-running request for the entire sync.

If the platform's free-tier restrictions prevent automatic continuation, use a user-triggered resume action or a lightweight, controlled continuation mechanism that remains within the free plan.

Do not add a paid queue, scheduler or background worker.

## Job completion

Only mark a job as `completed` when all requested sources and tabs have been processed successfully.

Use `completed_with_errors` when at least one source or tab failed but other requested work completed.

Use `failed` only when the job cannot make further safe progress.

Calculate final counts from the persisted job events or transactionally maintained counters, not from unreliable frontend estimates.

---

# 8. ALGORITHM G: ERROR HANDLING AND RECOVERY

Implement explicit error categories:

```text
INVALID_SOURCE_URL
ACCESS_DENIED
SPREADSHEET_NOT_FOUND
TAB_NOT_FOUND
GOOGLE_API_QUOTA
GOOGLE_API_TEMPORARY_FAILURE
INVALID_HEADER_MAPPING
INVALID_ROW
DATABASE_WRITE_FAILURE
SYNC_LOCKED
SYNC_TIMEOUT
UNKNOWN_ERROR
```

For each error, save:
- Error category
- Source ID
- Tab ID, if relevant
- Row number, if relevant
- Human-readable description
- Retryability
- Timestamp

Use retries with bounded exponential backoff only for transient failures.

Do not retry permanent errors such as invalid URLs or denied access indefinitely.

Do not display raw credentials, private keys or sensitive API responses in the UI.

If one tab fails, continue processing other independent tabs where safe.

If the database is unavailable, stop processing before advancing checkpoints. Do not report success for data that was not persisted.

---

# 9. ALGORITHM H: SYNC RESULTS AND USER NOTIFICATION

The completion notification must reflect the actual database changes.

Example:

```text
SYNC COMPLETED

Sources scanned: 3
Tabs scanned: 5
Rows examined: 2,015

New ads added: 128
Existing ads updated: 24
Unchanged records: 1,840
Rows skipped: 3
Failed tabs: 0
```

These are example values, not actual results.

Store the summary with the sync job.

All authorized users should be able to see the updated library and the latest sync history.

Use a simple in-app notification or status panel. Do not add paid email or SMS notifications.

If real-time database subscriptions are already available and suitable, they can be used. Otherwise, implement modest frontend polling with a reasonable interval and stop polling when the job reaches a terminal state.

---

# 10. DATABASE IMPLEMENTATION GUIDELINES

Use the existing database if it is already suitable and free.

Otherwise, implement the shared storage layer with Supabase Free.

Use the following logical entities:

```text
workspaces
    id
    name
    created_at

profiles
    id
    display_name
    created_at

workspace_members
    workspace_id
    user_id
    role

sheet_sources
    id
    workspace_id
    spreadsheet_id
    spreadsheet_url
    source_name
    active
    created_by
    created_at
    updated_at

sheet_tabs
    id
    source_id
    tab_id
    tab_name
    selected
    platform
    field_mapping
    mapping_confidence
    last_scanned_at

ads
    id
    workspace_id
    platform
    platform_ad_id
    normalized_ad_url
    content_fingerprint
    canonical_fields
    raw_data
    created_at
    updated_at

ad_sources
    id
    ad_id
    source_id
    tab_id
    row_number
    source_row_hash
    last_seen_at

sync_jobs
    id
    workspace_id
    initiated_by
    status
    current_source_id
    current_tab_id
    checkpoint
    result_counts
    started_at
    updated_at
    completed_at

sync_errors
    id
    job_id
    source_id
    tab_id
    row_number
    error_code
    error_message
    retryable
    created_at
```

This is a logical reference schema. Adapt names and relationships to the actual project's needs, but preserve the required behavior.

Create indexes for:
- Workspace IDs
- Source IDs
- Tab IDs
- Platform
- Normalized ad URLs
- Platform-specific ad IDs
- Content fingerprints
- Sync job status

Use uniqueness constraints appropriate to the chosen identity hierarchy.

Do not create a uniqueness constraint that incorrectly prevents the same ad from having multiple source associations.

Implement row-level security for workspace data.

---

# 11. IMPORTANT IMPLEMENTATION CONSTRAINTS

1. Reuse the existing project's UI components, state management, API patterns and CSS wherever practical.
2. Keep the existing Ad Library working during development.
3. Do not replace existing functionality with placeholder data.
4. Do not hardcode sync counts or pretend an import has succeeded.
5. Do not use a paid AI service for field mapping.
6. Do not make the browser responsible for privileged Google Sheets API requests.
7. Do not expose service-role keys.
8. Do not use localStorage as the permanent source of truth for the shared library.
9. Do not introduce automatic deletion of ads when spreadsheet rows disappear.
10. Do not add unnecessary external dependencies.
11. Do not change the production website or push remote commits without my approval.
12. Keep the application compatible with the current Netlify Free deployment.
13. Document every manual credential and account setup requirement.
14. Test each stage before moving to the next one.

---

# 12. REQUIRED IMPLEMENTATION ORDER

Follow this sequence in the existing Antigravity workspace.

### Step 1 — Inspect the existing implementation
Locate the current Sync Now button, source management code, spreadsheet parser, data schema and storage mechanism.

Report briefly what exists and which files need changes.

### Step 2 — Implement the database and secure backend
Create the necessary schema and server-side API endpoints. Keep credentials outside the frontend.

### Step 3 — Implement source registration and tab discovery
Build the Google Sheets URL validation, metadata retrieval, tab-selection UI and persisted source configuration.

### Step 4 — Implement the column mapping engine
Build the normalization, alias matching, platform detection and manual correction functionality.

### Step 5 — Implement the import and deduplication algorithms
Build and test the deterministic record identity, content comparison, source association and upsert behavior.

### Step 6 — Implement resumable synchronization
Connect the actual Sync Now button to the persistent job workflow. Add checkpoints, batch processing, locking, recovery and accurate reporting.

### Step 7 — Implement shared library access
Ensure all authorized teammates can view the same records and use the existing search and filters. Add the source filter.

### Step 8 — Test and prepare deployment
Run the existing build and relevant tests. Verify that the new implementation remains compatible with Netlify Free and document all remaining manual setup.

Do not stop after generating a plan. Continue implementing in the existing project until you reach a genuine blocker, such as missing account credentials or an external setup that requires my action.

If blocked, clearly explain:
- What is already implemented
- What is waiting for credentials or setup
- The exact action I need to take
- How to continue after that action

---

# 13. DEFINITION OF DONE

The feature is complete only when all the following are true:

- I can add a Google Sheets URL without changing the source code.
- The app discovers the spreadsheet's available tabs.
- I can select one, several or all tabs.
- The app detects different spreadsheet layouts without relying on fixed column indexes.
- The app imports existing records into a persistent shared database.
- Clicking Sync Now scans all configured and selected sources.
- Newly added ads are inserted.
- Existing changed ads are updated without losing useful data.
- Repeated syncs do not create duplicates.
- Source associations are retained.
- The sync job can resume after an interruption.
- The completion notification displays actual counts.
- Three to four authorized teammates can use the same library.
- Existing search, filters, cards and detail views continue to work.
- The app remains deployable on Netlify Free.
- No paid service, paid API or paid add-on is required.
- Any manual account or credential setup is documented.
- Tests have been executed and actual results are reported.

**Use the attached architecture and sync flowchart as the design reference, and implement the algorithm specified above rather than inventing a different one.**