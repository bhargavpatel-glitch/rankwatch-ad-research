"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adsRouter = void 0;
const express_1 = require("express");
const adStore_1 = require("../services/adStore");
const hybridSearchEngine_1 = require("../search/hybridSearchEngine");
exports.adsRouter = (0, express_1.Router)();
function parseFilterParams(req) {
    const query = req.query.q || '';
    const brands = req.query.brands ? (Array.isArray(req.query.brands) ? req.query.brands : req.query.brands.split(',')) : undefined;
    const platforms = req.query.platforms ? (Array.isArray(req.query.platforms) ? req.query.platforms : req.query.platforms.split(',')) : undefined;
    const creativeTypes = req.query.creativeTypes ? (Array.isArray(req.query.creativeTypes) ? req.query.creativeTypes : req.query.creativeTypes.split(',')) : undefined;
    const categories = req.query.categories ? (Array.isArray(req.query.categories) ? req.query.categories : req.query.categories.split(',')) : undefined;
    const topics = req.query.topics ? (Array.isArray(req.query.topics) ? req.query.topics : req.query.topics.split(',')) : undefined;
    const hashtags = req.query.hashtags ? (Array.isArray(req.query.hashtags) ? req.query.hashtags : req.query.hashtags.split(',')) : undefined;
    const sort = req.query.sort;
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 40;
    const minConfidence = req.query.minConfidence;
    return {
        q: query,
        brands: brands?.filter(Boolean),
        platforms: platforms?.filter(Boolean),
        creativeTypes: creativeTypes?.filter(Boolean),
        categories: categories?.filter(Boolean),
        topics: topics?.filter(Boolean),
        hashtags: hashtags?.filter(Boolean),
        sort,
        page: Math.max(1, page),
        limit: Math.min(100, Math.max(1, limit)),
        minConfidence
    };
}
// GET /api/ads/search - Search endpoint with hybrid ranking
exports.adsRouter.get('/search', (req, res) => {
    try {
        const filters = parseFilterParams(req);
        const result = hybridSearchEngine_1.hybridSearchEngine.search(filters.q || '', filters);
        res.json(result);
    }
    catch (err) {
        console.error('[AdsRouter] Search error:', err);
        res.status(500).json({ error: 'Failed to process search query' });
    }
});
// GET /api/ads - Browse endpoint (also supports query and filters)
exports.adsRouter.get('/', (req, res) => {
    try {
        const filters = parseFilterParams(req);
        const result = hybridSearchEngine_1.hybridSearchEngine.search(filters.q || '', filters);
        res.json(result);
    }
    catch (err) {
        console.error('[AdsRouter] Browse error:', err);
        res.status(500).json({ error: 'Failed to browse ads' });
    }
});
// GET /api/ads/:id - Single ad details
exports.adsRouter.get('/:id', (req, res) => {
    try {
        const ad = adStore_1.adStore.getAdById(req.params.id);
        if (!ad) {
            return res.status(404).json({ error: 'Advertisement not found' });
        }
        res.json(ad);
    }
    catch (err) {
        console.error('[AdsRouter] Get ad error:', err);
        res.status(500).json({ error: 'Failed to retrieve ad' });
    }
});
// GET /api/ads/:id/similar - Similar ads discovery
exports.adsRouter.get('/:id/similar', (req, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit, 10) : 6;
        const similar = hybridSearchEngine_1.hybridSearchEngine.getSimilarAds(req.params.id, limit);
        res.json({ ads: similar });
    }
    catch (err) {
        console.error('[AdsRouter] Similar ads error:', err);
        res.status(500).json({ error: 'Failed to retrieve similar ads' });
    }
});
