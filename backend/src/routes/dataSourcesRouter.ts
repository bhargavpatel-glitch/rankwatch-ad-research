import { Router, Request, Response } from 'express';
import { dataSourceService } from '../services/dataSourceService';
import { syncService } from '../services/syncService';

export const dataSourcesRouter = Router();

// GET /api/data-sources - List all connected sources
dataSourcesRouter.get('/', (req: Request, res: Response) => {
  try {
    const sources = dataSourceService.getSources();
    res.json({ sources });
  } catch (err) {
    console.error('[DataSourcesRouter] Error listing sources:', err);
    res.status(500).json({ error: 'Failed to retrieve data sources' });
  }
});

// POST /api/data-sources - Connect a new Google Sheet
dataSourcesRouter.post('/', async (req: Request, res: Response) => {
  try {
    const { name, url } = req.body;
    if (!url) {
      return res.status(400).json({ error: 'Google Sheet URL is required' });
    }

    const result = dataSourceService.addSource(name || '', url);
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    // Trigger sync for this new sheet
    if (result.source) {
      syncService.triggerSync(result.source.sheetId);
    }

    res.status(201).json({ source: result.source });
  } catch (err) {
    console.error('[DataSourcesRouter] Error adding source:', err);
    res.status(500).json({ error: 'Failed to add data source' });
  }
});
