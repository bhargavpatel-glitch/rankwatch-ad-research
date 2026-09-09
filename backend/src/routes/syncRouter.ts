import { Router, Request, Response } from 'express';
import { syncService } from '../services/syncService';

export const syncRouter = Router();

// GET /api/sync/status - Realtime sync status
syncRouter.get('/status', (req: Request, res: Response) => {
  try {
    const status = syncService.getStatus();
    res.json(status);
  } catch (err) {
    console.error('[SyncRouter] Status error:', err);
    res.status(500).json({ error: 'Failed to retrieve sync status' });
  }
});

// POST /api/sync/trigger - Trigger sync
syncRouter.post('/trigger', async (req: Request, res: Response) => {
  try {
    const sheetId = req.body?.sheetId;
    // Asynchronous trigger without blocking the HTTP response
    syncService.triggerSync(sheetId);
    res.json({ message: 'Sync started successfully', status: syncService.getStatus() });
  } catch (err) {
    console.error('[SyncRouter] Trigger error:', err);
    res.status(500).json({ error: 'Failed to trigger sync' });
  }
});
