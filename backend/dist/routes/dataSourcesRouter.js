"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataSourcesRouter = void 0;
const express_1 = require("express");
const dataSourceService_1 = require("../services/dataSourceService");
const syncService_1 = require("../services/syncService");
exports.dataSourcesRouter = (0, express_1.Router)();
// GET /api/data-sources - List all connected sources
exports.dataSourcesRouter.get('/', (req, res) => {
    try {
        const sources = dataSourceService_1.dataSourceService.getSources();
        res.json({ sources });
    }
    catch (err) {
        console.error('[DataSourcesRouter] Error listing sources:', err);
        res.status(500).json({ error: 'Failed to retrieve data sources' });
    }
});
// POST /api/data-sources - Connect a new Google Sheet
exports.dataSourcesRouter.post('/', async (req, res) => {
    try {
        const { name, url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'Google Sheet URL is required' });
        }
        const result = dataSourceService_1.dataSourceService.addSource(name || '', url);
        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }
        // Trigger sync for this new sheet
        if (result.source) {
            syncService_1.syncService.triggerSync(result.source.sheetId);
        }
        res.status(201).json({ source: result.source });
    }
    catch (err) {
        console.error('[DataSourcesRouter] Error adding source:', err);
        res.status(500).json({ error: 'Failed to add data source' });
    }
});
