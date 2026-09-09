"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hybridSearchEngine = exports.HybridSearchEngine = void 0;
const adStore_1 = require("../services/adStore");
const queryPipeline_1 = require("./queryPipeline");
class HybridSearchEngine {
    adList = [];
    adDocTokens = new Map();
    adConceptSets = new Map();
    constructor() {
        this.reindex();
    }
    reindex() {
        this.adList = adStore_1.adStore.getAllAds();
        this.adDocTokens.clear();
        this.adConceptSets.clear();
        for (const ad of this.adList) {
            // Token set for fast membership test
            const tokens = new Set();
            const rawText = `${ad.brand} ${ad.title} ${ad.summary} ${ad.adCopy} ${ad.category} ${ad.platform} ${ad.creativeType} ${ad.topics.join(' ')} ${ad.hashtags.join(' ')}`.toLowerCase();
            const words = rawText.replace(/[^\w\s]/g, ' ').split(/\s+/);
            for (const w of words) {
                if (w.length > 1) {
                    tokens.add((0, queryPipeline_1.normalizeWord)(w));
                }
            }
            this.adDocTokens.set(ad.id, tokens);
            // Concept set
            const concepts = new Set();
            for (const c of ad.searchConcepts) {
                concepts.add(c.toLowerCase());
            }
            for (const t of ad.topics) {
                concepts.add(t.toLowerCase());
            }
            this.adConceptSets.set(ad.id, concepts);
        }
        console.log(`[HybridSearchEngine] Indexed ${this.adList.length} ads for hybrid lexical-semantic search`);
    }
    search(queryStr, filters = {}) {
        const startTime = Date.now();
        const parsedQuery = (0, queryPipeline_1.parseSearchQuery)(queryStr);
        const hasQuery = parsedQuery.normalized.length > 0;
        // First apply hard filters if any
        let candidates = adStore_1.adStore.filterAds(this.adList, filters);
        // If query is empty, return filtered browse results
        if (!hasQuery) {
            const sorted = adStore_1.adStore.sortAds(candidates, filters.sort);
            const page = filters.page || 1;
            const limit = filters.limit || 40;
            const paged = sorted.slice((page - 1) * limit, page * limit);
            const items = paged.map(ad => ({
                ad,
                score: 1.0,
                confidence: 'high',
                explanation: {
                    matchedFields: ['browse'],
                    exactMatch: false,
                    brandMatch: false,
                    scoreBreakdown: {
                        exactScore: 0,
                        brandScore: 0,
                        phraseScore: 0,
                        fieldScore: 1.0,
                        semanticScore: 0,
                        featureScore: 0,
                        categoryScore: 0,
                        platformScore: 0,
                        total: 1.0
                    },
                    highlightTerms: [],
                    explanationNote: 'Filtered browse view'
                }
            }));
            const filterAgg = adStore_1.adStore.getAggregatedFilters();
            return {
                query: queryStr,
                parsedQuery: {
                    normalized: parsedQuery.normalized,
                    terms: parsedQuery.terms,
                    detectedBrands: parsedQuery.detectedBrands,
                    detectedPlatforms: parsedQuery.detectedPlatforms,
                    detectedCategories: parsedQuery.detectedCategories,
                    detectedCreativeTypes: parsedQuery.detectedCreativeTypes,
                    detectedConcepts: parsedQuery.detectedConcepts,
                    intent: parsedQuery.intent
                },
                totalResults: candidates.length,
                results: items,
                tookMs: Date.now() - startTime,
                availableFiltersSummary: {
                    brandsCount: filterAgg.brands.length,
                    platformsCount: filterAgg.platforms.length,
                    categoriesCount: filterAgg.categories.length,
                    creativeTypesCount: filterAgg.creativeTypes.length
                }
            };
        }
        // Score all candidates
        const scoredCandidates = [];
        const queryNormalized = parsedQuery.normalized;
        const queryTerms = parsedQuery.terms;
        const phrases = parsedQuery.phrases;
        const queryBrands = parsedQuery.detectedBrands;
        const queryPlatforms = parsedQuery.detectedPlatforms;
        const queryConcepts = parsedQuery.detectedConcepts;
        const expandedTerms = parsedQuery.expandedTerms;
        for (const ad of candidates) {
            const adTokens = this.adDocTokens.get(ad.id) || new Set();
            const adConcepts = this.adConceptSets.get(ad.id) || new Set();
            let exactScore = 0;
            let brandScore = 0;
            let phraseScore = 0;
            let fieldScore = 0;
            let semanticScore = 0;
            let featureScore = 0;
            let categoryScore = 0;
            let platformScore = 0;
            const matchedFields = [];
            const highlightTerms = [];
            const adBrandLower = ad.brand.toLowerCase();
            const adTitleLower = ad.title.toLowerCase();
            const adSummaryLower = ad.summary.toLowerCase();
            const adCopyLower = ad.adCopy.toLowerCase();
            const adPlatformLower = ad.platform.toLowerCase();
            const adCategoryLower = ad.category.toLowerCase();
            const adCreativeTypeLower = ad.creativeType.toLowerCase();
            const adTopicsLower = ad.topics.map(t => t.toLowerCase());
            // 1. EXACT BRAND MATCH (Weight: +50.0)
            for (const b of queryBrands) {
                if (adBrandLower === b || adBrandLower.includes(b)) {
                    brandScore += 45.0;
                    matchedFields.push('brand');
                    highlightTerms.push(ad.brand);
                    if (adBrandLower === b) {
                        exactScore += 15.0; // Perfect exact brand match bonus
                    }
                }
            }
            // Format match boost (e.g., 'document ad', 'video', 'reel')
            for (const fmt of parsedQuery.detectedCreativeTypes) {
                if (adCreativeTypeLower.includes(fmt.toLowerCase())) {
                    featureScore += 35.0;
                    if (!matchedFields.includes('creative format'))
                        matchedFields.push(`format: ${ad.creativeType}`);
                    highlightTerms.push(fmt);
                }
            }
            // 2. EXACT VERBATIM PHRASE MATCH IN TITLE OR COPY
            if (queryNormalized.length >= 4) {
                if (adTitleLower.includes(queryNormalized)) {
                    phraseScore += 35.0;
                    matchedFields.push('title (exact phrase)');
                    highlightTerms.push(queryNormalized);
                }
                else if (adSummaryLower.includes(queryNormalized)) {
                    phraseScore += 20.0;
                    matchedFields.push('summary (exact phrase)');
                    highlightTerms.push(queryNormalized);
                }
                else if (adCopyLower.includes(queryNormalized)) {
                    phraseScore += 15.0;
                    matchedFields.push('adCopy (exact phrase)');
                    highlightTerms.push(queryNormalized);
                }
            }
            // Multi-word phrase matches
            for (const p of phrases) {
                if (adTitleLower.includes(p)) {
                    phraseScore += 12.0;
                    if (!matchedFields.includes('title'))
                        matchedFields.push('title');
                    highlightTerms.push(p);
                }
                else if (adSummaryLower.includes(p) || adCopyLower.includes(p)) {
                    phraseScore += 8.0;
                    if (!matchedFields.includes('copy'))
                        matchedFields.push('copy');
                    highlightTerms.push(p);
                }
            }
            // 3. FIELD WEIGHTED TOKEN MATCHES
            let matchedTermsCount = 0;
            for (const term of queryTerms) {
                let termFoundInAd = false;
                // Title match (Weight: 22.0)
                if (adTitleLower.includes(term)) {
                    fieldScore += 22.0;
                    termFoundInAd = true;
                    if (!matchedFields.includes('title'))
                        matchedFields.push('title');
                    highlightTerms.push(term);
                }
                // Brand match (Weight: 20.0)
                if (adBrandLower.includes(term)) {
                    fieldScore += 20.0;
                    termFoundInAd = true;
                    if (!matchedFields.includes('brand'))
                        matchedFields.push('brand');
                    highlightTerms.push(term);
                }
                // Summary / Caption match (Weight: 14.0)
                if (adSummaryLower.includes(term)) {
                    fieldScore += 14.0;
                    termFoundInAd = true;
                    if (!matchedFields.includes('summary'))
                        matchedFields.push('summary');
                    highlightTerms.push(term);
                }
                else if (adCopyLower.includes(term)) {
                    fieldScore += 10.0;
                    termFoundInAd = true;
                    if (!matchedFields.includes('adCopy'))
                        matchedFields.push('adCopy');
                    highlightTerms.push(term);
                }
                // Topics / Keywords match (Weight: 16.0)
                for (const topic of adTopicsLower) {
                    if (topic.includes(term)) {
                        featureScore += 16.0;
                        termFoundInAd = true;
                        if (!matchedFields.includes('topics'))
                            matchedFields.push(`topic: ${topic}`);
                        highlightTerms.push(term);
                        break;
                    }
                }
                // Category match (Weight: 10.0)
                if (adCategoryLower.includes(term)) {
                    categoryScore += 10.0;
                    termFoundInAd = true;
                    if (!matchedFields.includes('category'))
                        matchedFields.push('category');
                    highlightTerms.push(term);
                }
                // Format / Creative Type match (Weight: 18.0)
                if (adCreativeTypeLower.includes(term)) {
                    featureScore += 18.0;
                    termFoundInAd = true;
                    if (!matchedFields.includes('creative type'))
                        matchedFields.push(`format: ${ad.creativeType}`);
                    highlightTerms.push(term);
                }
                // Platform match (Weight: 8.0)
                if (adPlatformLower.includes(term)) {
                    platformScore += 8.0;
                    termFoundInAd = true;
                    if (!matchedFields.includes('platform'))
                        matchedFields.push('platform');
                    highlightTerms.push(term);
                }
                // Token membership fallback
                if (adTokens.has(term)) {
                    termFoundInAd = true;
                }
                if (termFoundInAd) {
                    matchedTermsCount++;
                }
            }
            // 4. SEMANTIC & CONCEPT ALIGNMENT
            for (const concept of queryConcepts) {
                if (adConcepts.has(concept)) {
                    semanticScore += 20.0;
                    if (!matchedFields.includes('concepts'))
                        matchedFields.push(`concept: ${concept}`);
                }
            }
            for (const exp of expandedTerms) {
                if (adTitleLower.includes(exp) || adSummaryLower.includes(exp) || adConcepts.has(exp)) {
                    semanticScore += 8.0;
                    if (!matchedFields.includes('semantic match'))
                        matchedFields.push('semantic match');
                    highlightTerms.push(exp);
                }
            }
            // Multi-word term coverage ratio
            const termCoverage = queryTerms.length > 0 ? matchedTermsCount / queryTerms.length : 1;
            // STRICT MULTI-WORD QUERY RULE:
            // If query has 2+ terms and coverage is low (e.g. user typed "video editing AI" and ad only matched "AI"),
            // heavily penalize or discard, unless it was an exact brand match!
            if (queryTerms.length >= 2 && brandScore === 0) {
                if (termCoverage < 0.5 && semanticScore === 0 && phraseScore === 0) {
                    // Zero out completely if only 1 isolated generic token matched in a multi-word search
                    continue;
                }
                // Multiply field score by coverage factor to reward ads that match all parts of intent
                fieldScore = fieldScore * Math.pow(termCoverage, 1.5);
            }
            const totalScore = exactScore + brandScore + phraseScore + fieldScore + semanticScore + featureScore + categoryScore + platformScore;
            // RELEVANCE THRESHOLD: suppress noisy low scores
            if (totalScore < 10.0) {
                continue;
            }
            let confidence = 'low';
            if (totalScore >= 45.0 || exactScore > 0 || brandScore >= 40.0 || phraseScore >= 20.0) {
                confidence = 'high';
            }
            else if (totalScore >= 18.0) {
                confidence = 'medium';
            }
            // Filter by min confidence if specified
            if (filters.minConfidence === 'high' && confidence !== 'high') {
                continue;
            }
            else if (filters.minConfidence === 'medium' && confidence === 'low') {
                continue;
            }
            // Generate explainable match note
            let explanationNote = '';
            if (exactScore > 0 && brandScore > 0) {
                explanationNote = `Exact brand match on '${ad.brand}' with high relevance score.`;
            }
            else if (phraseScore >= 20.0) {
                explanationNote = `Exact verbatim phrase matched in headline or copy.`;
            }
            else if (semanticScore >= 15.0) {
                explanationNote = `Semantic concept match on '${matchedFields.filter(f => f.startsWith('concept:')).join(', ')}' (${Math.round(termCoverage * 100)}% query coverage).`;
            }
            else if (featureScore > 0) {
                explanationNote = `Matched topic and marketing feature in ${ad.category}.`;
            }
            else {
                explanationNote = `Lexical relevance match across ${matchedFields.slice(0, 3).join(', ')}.`;
            }
            const explanation = {
                matchedFields: Array.from(new Set(matchedFields)),
                exactMatch: exactScore > 0,
                brandMatch: brandScore > 0,
                scoreBreakdown: {
                    exactScore: Math.round(exactScore * 10) / 10,
                    brandScore: Math.round(brandScore * 10) / 10,
                    phraseScore: Math.round(phraseScore * 10) / 10,
                    fieldScore: Math.round(fieldScore * 10) / 10,
                    semanticScore: Math.round(semanticScore * 10) / 10,
                    featureScore: Math.round(featureScore * 10) / 10,
                    categoryScore: Math.round(categoryScore * 10) / 10,
                    platformScore: Math.round(platformScore * 10) / 10,
                    total: Math.round(totalScore * 10) / 10
                },
                highlightTerms: Array.from(new Set(highlightTerms)).slice(0, 8),
                explanationNote
            };
            scoredCandidates.push({
                ad,
                score: totalScore,
                confidence,
                explanation
            });
        }
        // Sort by finalScore descending (or requested sort)
        if (!filters.sort || filters.sort === 'relevant') {
            scoredCandidates.sort((a, b) => b.score - a.score);
        }
        else {
            const sortedAds = adStore_1.adStore.sortAds(scoredCandidates.map(c => c.ad), filters.sort);
            const adIdToOrder = new Map(sortedAds.map((ad, idx) => [ad.id, idx]));
            scoredCandidates.sort((a, b) => (adIdToOrder.get(a.ad.id) || 0) - (adIdToOrder.get(b.ad.id) || 0));
        }
        const page = filters.page || 1;
        const limit = filters.limit || 40;
        const paged = scoredCandidates.slice((page - 1) * limit, page * limit);
        // Suggested queries if low or zero results
        let suggestedQueries;
        if (scoredCandidates.length <= 5) {
            suggestedQueries = [
                'AI search and GEO',
                'Semrush enterprise',
                'Answer engine optimization',
                'Peec AI reel',
                'Profound marketing agent',
                'Document Ad carousel'
            ].filter(s => s.toLowerCase() !== queryNormalized);
        }
        const filterAgg = adStore_1.adStore.getAggregatedFilters();
        return {
            query: queryStr,
            parsedQuery: {
                normalized: parsedQuery.normalized,
                terms: parsedQuery.terms,
                detectedBrands: parsedQuery.detectedBrands,
                detectedPlatforms: parsedQuery.detectedPlatforms,
                detectedCategories: parsedQuery.detectedCategories,
                detectedCreativeTypes: parsedQuery.detectedCreativeTypes,
                detectedConcepts: parsedQuery.detectedConcepts,
                intent: parsedQuery.intent
            },
            totalResults: scoredCandidates.length,
            results: paged,
            tookMs: Date.now() - startTime,
            suggestedQueries,
            availableFiltersSummary: {
                brandsCount: filterAgg.brands.length,
                platformsCount: filterAgg.platforms.length,
                categoriesCount: filterAgg.categories.length,
                creativeTypesCount: filterAgg.creativeTypes.length
            }
        };
    }
    getSimilarAds(targetAdId, limit = 6) {
        const target = adStore_1.adStore.getAdById(targetAdId);
        if (!target)
            return [];
        const targetConcepts = new Set(target.searchConcepts.map(c => c.toLowerCase()));
        const targetTopics = new Set(target.topics.map(t => t.toLowerCase()));
        const candidates = this.adList.filter(a => a.id !== targetAdId);
        const scored = [];
        for (const ad of candidates) {
            let similarityScore = 0;
            // Same brand boost
            if (ad.brand === target.brand) {
                similarityScore += 25.0;
            }
            // Same platform boost
            if (ad.platform === target.platform) {
                similarityScore += 10.0;
            }
            // Same creative type
            if (ad.creativeType === target.creativeType) {
                similarityScore += 12.0;
            }
            // Shared topics
            for (const t of ad.topics) {
                if (targetTopics.has(t.toLowerCase())) {
                    similarityScore += 15.0;
                }
            }
            // Shared concepts
            for (const c of ad.searchConcepts) {
                if (targetConcepts.has(c.toLowerCase())) {
                    similarityScore += 10.0;
                }
            }
            // Same category
            if (ad.category === target.category) {
                similarityScore += 8.0;
            }
            if (similarityScore > 10.0) {
                scored.push({ ad, score: similarityScore });
            }
        }
        scored.sort((a, b) => b.score - a.score);
        return scored.slice(0, limit).map(s => s.ad);
    }
}
exports.HybridSearchEngine = HybridSearchEngine;
exports.hybridSearchEngine = new HybridSearchEngine();
