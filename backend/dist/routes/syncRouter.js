"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncRouter = void 0;
const express_1 = require("express");
const syncService_1 = require("../services/syncService");
exports.syncRouter = (0, express_1.Router)();
// GET /api/sync/status - Realtime sync status
exports.syncRouter.get('/status', (req, res) => {
    try {
        const status = syncService_1.syncService.getStatus();
        res.json(status);
    }
    catch (err) {
        console.error('[SyncRouter] Status error:', err);
        res.status(500).json({ error: 'Failed to retrieve sync status' });
    }
});
// POST /api/sync/trigger - Trigger sync
exports.syncRouter.post('/trigger', async (req, res) => {
    try {
        const sheetId = req.body?.sheetId;
        // Asynchronous trigger without blocking the HTTP response
        syncService_1.syncService.triggerSync(sheetId);
        res.json({ message: 'Sync started successfully', status: syncService_1.syncService.getStatus() });
    }
    catch (err) {
        console.error('[SyncRouter] Trigger error:', err);
        res.status(500).json({ error: 'Failed to trigger sync' });
    }
});
