"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("./config");
const adsRouter_1 = require("./routes/adsRouter");
const filtersRouter_1 = require("./routes/filtersRouter");
const syncRouter_1 = require("./routes/syncRouter");
const dataSourcesRouter_1 = require("./routes/dataSourcesRouter");
const groupsRouter_1 = require("./routes/groupsRouter");
const mediaRouter_1 = require("./routes/mediaRouter");
dotenv_1.default.config();
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// API Routes
app.use('/api/ads', adsRouter_1.adsRouter);
app.use('/api/filters', filtersRouter_1.filtersRouter);
app.use('/api/sync', syncRouter_1.syncRouter);
app.use('/api/data-sources', dataSourcesRouter_1.dataSourcesRouter);
app.use('/api/groups', groupsRouter_1.groupsRouter);
app.use('/api/media', mediaRouter_1.mediaRouter);
// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        service: 'Ad Library Intelligence Backend'
    });
});
// Serve frontend static build in production
const frontendDist = path_1.default.resolve(__dirname, '../../frontend/dist');
if (fs_1.default.existsSync(frontendDist)) {
    app.use(express_1.default.static(frontendDist));
    app.get('*', (req, res, next) => {
        if (req.path.startsWith('/api'))
            return next();
        res.sendFile(path_1.default.join(frontendDist, 'index.html'));
    });
}
app.listen(config_1.CONFIG.PORT, () => {
    console.log(`====================================================`);
    console.log(`🚀 Ad Library Intelligence API listening on port ${config_1.CONFIG.PORT}`);
    console.log(`   Health Check: http://localhost:${config_1.CONFIG.PORT}/api/health`);
    console.log(`   Search API:   http://localhost:${config_1.CONFIG.PORT}/api/ads/search?q=AI`);
    console.log(`   Filters API:  http://localhost:${config_1.CONFIG.PORT}/api/filters`);
    console.log(`====================================================`);
});
