"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.filtersRouter = void 0;
const express_1 = require("express");
const adStore_1 = require("../services/adStore");
exports.filtersRouter = (0, express_1.Router)();
// GET /api/filters - Aggregated filter values with live counts
exports.filtersRouter.get('/', (req, res) => {
    try {
        const filters = adStore_1.adStore.getAggregatedFilters();
        res.json(filters);
    }
    catch (err) {
        console.error('[FiltersRouter] Error aggregating filters:', err);
        res.status(500).json({ error: 'Failed to aggregate filters' });
    }
});
