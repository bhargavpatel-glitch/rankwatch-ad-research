"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeWord = normalizeWord;
exports.parseSearchQuery = parseSearchQuery;
const KNOWN_BRANDS = [
    'semrush', 'peec ai', 'peec', 'tryprofound', 'profound', 'cooper square',
    'otterlyai', 'otterly', 'scrunch', 'mangools', 'accuranker', 'rankscale',
    'athenahq', 'nuvotech', 'codecat', 'etarg', 'canva', 'mongodb', 'hyperfavor',
    'digital funda', 'zentravyx', 'hera seo', 'shelea kirksey', 'affi tech'
];
const KNOWN_PLATFORMS = [
    { name: 'Google Ads', aliases: ['google', 'google ads', 'search ads', 'adwords'] },
    { name: 'Meta Ads', aliases: ['meta', 'meta ads', 'facebook', 'fb', 'meta ad library'] },
    { name: 'Instagram tagged', aliases: ['instagram tagged', 'instagram', 'insta', 'reels', 'reel', 'ig', 'tagged'] },
    { name: 'LinkedIn', aliases: ['linkedin', 'linkedin ads', 'licdn'] },
    { name: 'TikTok', aliases: ['tiktok', 'tt'] },
    { name: 'YouTube', aliases: ['youtube', 'yt'] }
];
const KNOWN_FORMATS = [
    { name: 'Document Ad', aliases: ['document', 'document ad', 'pdf', 'slide deck', 'carousel'] },
    { name: 'Single Image Ad', aliases: ['single image', 'image ad', 'static ad', 'photo'] },
    { name: 'Video', aliases: ['video', 'video ad', 'motion'] },
    { name: 'Reel', aliases: ['reel', 'reels', 'short form', 'insta reel'] },
    { name: 'Search Ad / Landing Page', aliases: ['search ad', 'text ad', 'landing page'] }
];
const CONCEPT_SYNONYMS = {
    'aeo': ['answer engine optimization', 'ai search', 'llm citation', 'prompt analytics'],
    'geo': ['generative engine optimization', 'ai search visibility', 'generative ai'],
    'seo': ['search engine optimization', 'keyword ranking', 'organic search', 'backlinks', 'serp'],
    'ai search': ['answer engine', 'generative engine', 'chatgpt', 'perplexity', 'gemini citation', 'llm'],
    'autonomous ai': ['autonomous agent', 'ai agent', 'background agent', 'ai marketer'],
    'video tool': ['video generator', 'text to video', 'ai video', 'video creator', 'video editing'],
    'ugc': ['user generated content', 'creator', 'founder-led', 'testimonial'],
    'landing page': ['conversion page', 'website builder', 'landing page creation', 'lead magnet'],
    'lead gen': ['lead generation', 'whitepaper', 'b2b lead', 'demo', 'consultation'],
    'case study': ['roi', 'customer story', 'success story', 'increased visibility', 'benchmark'],
    'pricing': ['subscription', 'plans', 'discount', 'free trial', 'enterprise tier']
};
function normalizeWord(word) {
    let w = word.toLowerCase().trim();
    // Strip trailing punctuation
    w = w.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, '');
    // Basic stemming / plural normalization
    if (w.endsWith('ies') && w.length > 4) {
        w = w.slice(0, -3) + 'y'; // categories -> category
    }
    else if (w.endsWith('ses') && w.length > 4) {
        w = w.slice(0, -2); // analyses -> analyse
    }
    else if (w.endsWith('s') && !w.endsWith('ss') && !w.endsWith('us') && w.length > 3) {
        w = w.slice(0, -1); // ads -> ad, tools -> tool, reels -> reel, videos -> video
    }
    return w;
}
function parseSearchQuery(query) {
    const raw = query || '';
    // Normalize query: lowercase, collapse whitespace, unify hyphens
    let normalized = raw.toLowerCase().trim();
    normalized = normalized.replace(/[-_]/g, ' '); // ai-video -> ai video
    normalized = normalized.replace(/[^\w\s#]/gi, ' ');
    normalized = normalized.replace(/\s+/g, ' ').trim();
    const terms = normalized
        .split(' ')
        .map(t => normalizeWord(t))
        .filter(t => t.length > 0 && !['a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'with'].includes(t));
    // Extract explicit multi-word phrases (e.g. "ai video", "search visibility")
    const phrases = [];
    const words = normalized.split(' ').filter(w => w.length > 0);
    for (let i = 0; i < words.length - 1; i++) {
        phrases.push(`${words[i]} ${words[i + 1]}`);
        if (i < words.length - 2) {
            phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
        }
    }
    // Detect Brands
    const detectedBrands = [];
    for (const brand of KNOWN_BRANDS) {
        if (normalized.includes(brand)) {
            detectedBrands.push(brand);
        }
    }
    // Detect Platforms
    const detectedPlatforms = [];
    for (const plat of KNOWN_PLATFORMS) {
        for (const alias of plat.aliases) {
            if (normalized.includes(alias)) {
                detectedPlatforms.push(plat.name);
                break;
            }
        }
    }
    // Detect Formats
    const detectedCreativeTypes = [];
    for (const fmt of KNOWN_FORMATS) {
        for (const alias of fmt.aliases) {
            if (normalized.includes(alias)) {
                detectedCreativeTypes.push(fmt.name);
                break;
            }
        }
    }
    // Detect Concepts & Expand
    const detectedConcepts = [];
    const expandedTerms = [];
    for (const [conceptKey, synonyms] of Object.entries(CONCEPT_SYNONYMS)) {
        if (normalized.includes(conceptKey)) {
            detectedConcepts.push(conceptKey);
            expandedTerms.push(...synonyms);
        }
        else {
            for (const syn of synonyms) {
                if (normalized.includes(syn)) {
                    detectedConcepts.push(conceptKey);
                    expandedTerms.push(...synonyms);
                    break;
                }
            }
        }
    }
    // Classify Intent
    let intent = 'general';
    if (detectedBrands.length > 0 && terms.length <= 3) {
        intent = 'brand_lookup';
    }
    else if (detectedPlatforms.length > 0 && terms.length <= 3) {
        intent = 'platform_filter';
    }
    else if (detectedCreativeTypes.length > 0) {
        intent = 'format_search';
    }
    else if (detectedConcepts.length > 0) {
        intent = 'concept_discovery';
    }
    return {
        raw,
        normalized,
        terms,
        phrases,
        detectedBrands,
        detectedPlatforms,
        detectedCategories: [],
        detectedCreativeTypes,
        detectedConcepts,
        intent,
        expandedTerms: Array.from(new Set(expandedTerms))
    };
}
