"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.adStore = exports.AdStore = void 0;
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
class AdStore {
    ads = [];
    adMap = new Map();
    filtersCache = null;
    isLoaded = false;
    constructor() {
        this.loadData();
    }
    loadData() {
        try {
            if (fs_1.default.existsSync(config_1.CONFIG.ADS_FILE)) {
                const raw = fs_1.default.readFileSync(config_1.CONFIG.ADS_FILE, 'utf-8');
                this.ads = JSON.parse(raw);
                this.adMap.clear();
                for (const ad of this.ads) {
                    this.adMap.set(ad.id, ad);
                }
                this.filtersCache = null; // Invalidate cache
                this.isLoaded = true;
                console.log(`[AdStore] Loaded ${this.ads.length} canonical ads from ${config_1.CONFIG.ADS_FILE}`);
            }
            else {
                console.warn(`[AdStore] Ads file not found at ${config_1.CONFIG.ADS_FILE}`);
                this.ads = [];
                this.adMap.clear();
            }
        }
        catch (err) {
            console.error('[AdStore] Error loading ads:', err);
            this.ads = [];
            this.adMap.clear();
        }
    }
    getAllAds() {
        return this.ads;
    }
    getAdById(id) {
        return this.adMap.get(id);
    }
    getTotalCount() {
        return this.ads.length;
    }
    getAggregatedFilters() {
        if (this.filtersCache) {
            return this.filtersCache;
        }
        const brandCounts = {};
        const platformCounts = {};
        const creativeTypeCounts = {};
        const categoryCounts = {};
        const topicCounts = {};
        const hashtagCounts = {};
        for (const ad of this.ads) {
            if (ad.brand) {
                brandCounts[ad.brand] = (brandCounts[ad.brand] || 0) + 1;
            }
            if (ad.platform) {
                platformCounts[ad.platform] = (platformCounts[ad.platform] || 0) + 1;
            }
            if (ad.creativeType) {
                creativeTypeCounts[ad.creativeType] = (creativeTypeCounts[ad.creativeType] || 0) + 1;
            }
            if (ad.category) {
                categoryCounts[ad.category] = (categoryCounts[ad.category] || 0) + 1;
            }
            for (const t of ad.topics) {
                if (t && t.length > 1) {
                    topicCounts[t] = (topicCounts[t] || 0) + 1;
                }
            }
            for (const h of ad.hashtags) {
                if (h && h.length > 1) {
                    hashtagCounts[h] = (hashtagCounts[h] || 0) + 1;
                }
            }
        }
        const toSortedArray = (counts) => Object.entries(counts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        this.filtersCache = {
            brands: toSortedArray(brandCounts),
            platforms: toSortedArray(platformCounts),
            creativeTypes: toSortedArray(creativeTypeCounts),
            categories: toSortedArray(categoryCounts),
            topics: toSortedArray(topicCounts),
            hashtags: toSortedArray(hashtagCounts),
            totalAds: this.ads.length
        };
        return this.filtersCache;
    }
    filterAds(adsList, filters) {
        return adsList.filter(ad => {
            // Platform filter (OR within selected)
            if (filters.platforms && filters.platforms.length > 0) {
                if (!filters.platforms.includes(ad.platform)) {
                    return false;
                }
            }
            // Brand filter (OR within selected)
            if (filters.brands && filters.brands.length > 0) {
                if (!filters.brands.includes(ad.brand)) {
                    return false;
                }
            }
            // Creative Type filter
            if (filters.creativeTypes && filters.creativeTypes.length > 0) {
                if (!filters.creativeTypes.includes(ad.creativeType)) {
                    return false;
                }
            }
            // Category filter
            if (filters.categories && filters.categories.length > 0) {
                if (!filters.categories.includes(ad.category)) {
                    return false;
                }
            }
            // Topics filter
            if (filters.topics && filters.topics.length > 0) {
                const hasTopic = filters.topics.some(t => ad.topics.includes(t));
                if (!hasTopic) {
                    return false;
                }
            }
            // Hashtags filter
            if (filters.hashtags && filters.hashtags.length > 0) {
                const hasTag = filters.hashtags.some(h => ad.hashtags.includes(h));
                if (!hasTag) {
                    return false;
                }
            }
            return true;
        });
    }
    sortAds(adsList, sortOption) {
        const list = [...adsList];
        switch (sortOption) {
            case 'newest':
                return list.reverse();
            case 'oldest':
                return list;
            case 'brand_asc':
                return list.sort((a, b) => a.brand.localeCompare(b.brand));
            case 'brand_desc':
                return list.sort((a, b) => b.brand.localeCompare(a.brand));
            case 'relevant':
            default:
                return list;
        }
    }
}
exports.AdStore = AdStore;
exports.adStore = new AdStore();
