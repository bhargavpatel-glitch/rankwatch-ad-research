"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.dataSourceService = exports.DataSourceService = void 0;
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
class DataSourceService {
    sources = [];
    constructor() {
        this.loadSources();
    }
    loadSources() {
        try {
            if (fs_1.default.existsSync(config_1.CONFIG.DATA_SOURCES_FILE)) {
                const raw = fs_1.default.readFileSync(config_1.CONFIG.DATA_SOURCES_FILE, 'utf-8');
                this.sources = JSON.parse(raw);
            }
            else {
                // Default primary sheet
                this.sources = [
                    {
                        id: 'source_primary',
                        name: config_1.CONFIG.DEFAULT_SHEET_NAME,
                        url: config_1.CONFIG.DEFAULT_SHEET_URL,
                        sheetId: config_1.CONFIG.DEFAULT_SHEET_ID,
                        status: 'active',
                        lastSyncedAt: new Date().toISOString(),
                        recordCount: 8285,
                        tabs: ['Google Ads', 'Meta Ads', 'Insta reel research', 'Linkedin ad research']
                    }
                ];
                this.saveSources();
            }
        }
        catch (err) {
            console.error('[DataSourceService] Error loading sources:', err);
            this.sources = [];
        }
    }
    saveSources() {
        try {
            fs_1.default.writeFileSync(config_1.CONFIG.DATA_SOURCES_FILE, JSON.stringify(this.sources, null, 2), 'utf-8');
        }
        catch (err) {
            console.error('[DataSourceService] Error saving sources:', err);
        }
    }
    getSources() {
        return this.sources;
    }
    extractSheetId(urlOrId) {
        if (!urlOrId)
            return null;
        const clean = urlOrId.trim();
        // Check if it's already an ID
        if (/^[a-zA-Z0-9-_]{20,60}$/.test(clean)) {
            return clean;
        }
        // Match Google Sheets URL format
        const match = clean.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i);
        if (match && match[1]) {
            return match[1];
        }
        return null;
    }
    addSource(name, url) {
        const sheetId = this.extractSheetId(url);
        if (!sheetId) {
            return { success: false, error: 'Invalid Google Sheet URL or ID format.' };
        }
        // Check if already exists
        const existing = this.sources.find(s => s.sheetId === sheetId);
        if (existing) {
            return { success: false, error: 'This Google Sheet is already connected as a data source.' };
        }
        const newSource = {
            id: `source_${Date.now()}`,
            name: name.trim() || `Google Sheet (${sheetId.slice(0, 8)}...)`,
            url: url.trim(),
            sheetId,
            status: 'pending',
            recordCount: 0,
            tabs: []
        };
        this.sources.push(newSource);
        this.saveSources();
        return { success: true, source: newSource };
    }
}
exports.DataSourceService = DataSourceService;
exports.dataSourceService = new DataSourceService();
