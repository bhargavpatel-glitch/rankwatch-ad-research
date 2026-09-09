import { Router, Request, Response } from 'express';
import { adStore } from '../services/adStore';

export const filtersRouter = Router();

// GET /api/filters - Aggregated filter values with live counts
filtersRouter.get('/', (req: Request, res: Response) => {
  try {
    const filters = adStore.getAggregatedFilters();
    res.json(filters);
  } catch (err) {
    console.error('[FiltersRouter] Error aggregating filters:', err);
    res.status(500).json({ error: 'Failed to aggregate filters' });
  }
});
