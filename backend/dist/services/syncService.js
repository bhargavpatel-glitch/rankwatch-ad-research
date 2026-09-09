"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncService = exports.SyncService = void 0;
const child_process_1 = require("child_process");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const adStore_1 = require("./adStore");
const hybridSearchEngine_1 = require("../search/hybridSearchEngine");
class SyncService {
    isSyncing = false;
    syncTimer = null;
    currentStage = 'Idle';
    progressPercent = 100;
    lastError = null;
    constructor() {
        this.initStatus();
        this.startBackgroundSync();
    }
    initStatus() {
        if (!fs_1.default.existsSync(config_1.CONFIG.SYNC_STATUS_FILE)) {
            const initial = {
                isSyncing: false,
                currentStage: 'Ready',
                progressPercent: 100,
                lastSyncedAt: new Date().toISOString(),
                recordsCount: adStore_1.adStore.getTotalCount(),
                newAdsCount: adStore_1.adStore.getTotalCount(),
                updatedAdsCount: 0,
                unchangedAdsCount: 0,
                deletedAdsCount: 0
            };
            fs_1.default.writeFileSync(config_1.CONFIG.SYNC_STATUS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
        }
    }
    getStatus() {
        try {
            if (fs_1.default.existsSync(config_1.CONFIG.SYNC_STATUS_FILE)) {
                const raw = fs_1.default.readFileSync(config_1.CONFIG.SYNC_STATUS_FILE, 'utf-8');
                const parsed = JSON.parse(raw);
                return {
                    ...parsed,
                    isSyncing: this.isSyncing,
                    currentStage: this.currentStage,
                    progressPercent: this.progressPercent,
                    error: this.lastError || undefined
                };
            }
        }
        catch (err) {
            console.error('[SyncService] Error reading status:', err);
        }
        return {
            isSyncing: this.isSyncing,
            currentStage: this.currentStage,
            progressPercent: this.progressPercent,
            recordsCount: adStore_1.adStore.getTotalCount(),
            newAdsCount: 0,
            updatedAdsCount: 0,
            unchangedAdsCount: adStore_1.adStore.getTotalCount(),
            deletedAdsCount: 0
        };
    }
    async triggerSync(sheetId = config_1.CONFIG.DEFAULT_SHEET_ID) {
        if (this.isSyncing) {
            return this.getStatus();
        }
        this.isSyncing = true;
        this.currentStage = 'Connecting to Google Sheet...';
        this.progressPercent = 15;
        this.lastError = null;
        return new Promise((resolve) => {
            const scriptPath = path_1.default.resolve(__dirname, '../ingestion/ingest_sheets.py');
            console.log(`[SyncService] Starting sync for sheet ID: ${sheetId}...`);
            const py = (0, child_process_1.spawn)('python', [scriptPath], {
                cwd: path_1.default.resolve(__dirname, '../../..'),
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            });
            this.currentStage = 'Downloading spreadsheet & extracting tabs...';
            this.progressPercent = 35;
            py.stdout.on('data', (data) => {
                const str = data.toString();
                console.log(`[Python Ingestion] ${str.trim()}`);
                if (str.includes("Tab '")) {
                    this.currentStage = `Parsing & normalizing: ${str.trim().slice(0, 50)}...`;
                    this.progressPercent = Math.min(85, this.progressPercent + 12);
                }
            });
            py.stderr.on('data', (data) => {
                console.warn(`[Python Ingestion Err] ${data.toString().trim()}`);
            });
            py.on('close', (code) => {
                this.isSyncing = false;
                if (code === 0) {
                    console.log('[SyncService] Ingestion completed successfully. Reloading adStore...');
                    this.currentStage = 'Rebuilding Search Index...';
                    this.progressPercent = 95;
                    adStore_1.adStore.loadData();
                    hybridSearchEngine_1.hybridSearchEngine.reindex();
                    this.currentStage = 'Ready';
                    this.progressPercent = 100;
                    this.lastError = null;
                    const updatedStatus = {
                        isSyncing: false,
                        currentStage: 'Ready',
                        progressPercent: 100,
                        lastSyncedAt: new Date().toISOString(),
                        recordsCount: adStore_1.adStore.getTotalCount(),
                        newAdsCount: 0,
                        updatedAdsCount: 0,
                        unchangedAdsCount: adStore_1.adStore.getTotalCount(),
                        deletedAdsCount: 0
                    };
                    fs_1.default.writeFileSync(config_1.CONFIG.SYNC_STATUS_FILE, JSON.stringify(updatedStatus, null, 2), 'utf-8');
                    resolve(updatedStatus);
                }
                else {
                    this.currentStage = 'Failed';
                    this.progressPercent = 0;
                    this.lastError = `Ingestion script exited with code ${code}`;
                    console.error(`[SyncService] ${this.lastError}`);
                    resolve(this.getStatus());
                }
            });
        });
    }
    startBackgroundSync() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
        this.syncTimer = setInterval(() => {
            console.log('[SyncService] Background sync scheduled check running...');
            this.triggerSync().catch(err => console.error('[SyncService] Auto sync error:', err));
        }, config_1.CONFIG.AUTO_SYNC_INTERVAL_MS);
    }
}
exports.SyncService = SyncService;
exports.syncService = new SyncService();
