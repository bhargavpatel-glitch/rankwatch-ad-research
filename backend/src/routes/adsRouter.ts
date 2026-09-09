import { Router, Request, Response } from 'express';
import { adStore } from '../services/adStore';
import { hybridSearchEngine } from '../search/hybridSearchEngine';
import { FilterOptions } from '../types';

export const adsRouter = Router();

function parseFilterParams(req: Request): FilterOptions {
  const query = (req.query.q as string) || '';
  const brands = req.query.brands ? (Array.isArray(req.query.brands) ? req.query.brands as string[] : (req.query.brands as string).split(',')) : undefined;
  const platforms = req.query.platforms ? (Array.isArray(req.query.platforms) ? req.query.platforms as string[] : (req.query.platforms as string).split(',')) : undefined;
  const creativeTypes = req.query.creativeTypes ? (Array.isArray(req.query.creativeTypes) ? req.query.creativeTypes as string[] : (req.query.creativeTypes as string).split(',')) : undefined;
  const categories = req.query.categories ? (Array.isArray(req.query.categories) ? req.query.categories as string[] : (req.query.categories as string).split(',')) : undefined;
  const topics = req.query.topics ? (Array.isArray(req.query.topics) ? req.query.topics as string[] : (req.query.topics as string).split(',')) : undefined;
  const hashtags = req.query.hashtags ? (Array.isArray(req.query.hashtags) ? req.query.hashtags as string[] : (req.query.hashtags as string).split(',')) : undefined;
  const sort = req.query.sort as FilterOptions['sort'];
  const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
  const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 40;
  const minConfidence = req.query.minConfidence as FilterOptions['minConfidence'];

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
adsRouter.get('/search', (req: Request, res: Response) => {
  try {
    const filters = parseFilterParams(req);
    const result = hybridSearchEngine.search(filters.q || '', filters);
    res.json(result);
  } catch (err) {
    console.error('[AdsRouter] Search error:', err);
    res.status(500).json({ error: 'Failed to process search query' });
  }
});

// GET /api/ads - Browse endpoint (also supports query and filters)
adsRouter.get('/', (req: Request, res: Response) => {
  try {
    const filters = parseFilterParams(req);
    const result = hybridSearchEngine.search(filters.q || '', filters);
    res.json(result);
  } catch (err) {
    console.error('[AdsRouter] Browse error:', err);
    res.status(500).json({ error: 'Failed to browse ads' });
  }
});

// GET /api/ads/:id - Single ad details
adsRouter.get('/:id', (req: Request, res: Response) => {
  try {
    const ad = adStore.getAdById(req.params.id);
    if (!ad) {
      return res.status(404).json({ error: 'Advertisement not found' });
    }
    res.json(ad);
  } catch (err) {
    console.error('[AdsRouter] Get ad error:', err);
    res.status(500).json({ error: 'Failed to retrieve ad' });
  }
});

// GET /api/ads/:id/similar - Similar ads discovery
adsRouter.get('/:id/similar', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 6;
    const similar = hybridSearchEngine.getSimilarAds(req.params.id, limit);
    res.json({ ads: similar });
  } catch (err) {
    console.error('[AdsRouter] Similar ads error:', err);
    res.status(500).json({ error: 'Failed to retrieve similar ads' });
  }
});
