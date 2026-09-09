import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { CONFIG } from './config';
import { adsRouter } from './routes/adsRouter';
import { filtersRouter } from './routes/filtersRouter';
import { syncRouter } from './routes/syncRouter';
import { dataSourcesRouter } from './routes/dataSourcesRouter';
import { groupsRouter } from './routes/groupsRouter';
import { mediaRouter } from './routes/mediaRouter';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/ads', adsRouter);
app.use('/api/filters', filtersRouter);
app.use('/api/sync', syncRouter);
app.use('/api/data-sources', dataSourcesRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/media', mediaRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'Ad Library Intelligence Backend'
  });
});

// Serve frontend static build in production
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

app.listen(CONFIG.PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 Ad Library Intelligence API listening on port ${CONFIG.PORT}`);
  console.log(`   Health Check: http://localhost:${CONFIG.PORT}/api/health`);
  console.log(`   Search API:   http://localhost:${CONFIG.PORT}/api/ads/search?q=AI`);
  console.log(`   Filters API:  http://localhost:${CONFIG.PORT}/api/filters`);
  console.log(`====================================================`);
});
