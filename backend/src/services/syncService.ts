import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { CONFIG } from '../config';
import { SyncStatus } from '../types';
import { adStore } from './adStore';
import { hybridSearchEngine } from '../search/hybridSearchEngine';

export class SyncService {
  private isSyncing = false;
  private syncTimer: NodeJS.Timeout | null = null;
  private currentStage = 'Idle';
  private progressPercent = 100;
  private lastError: string | null = null;

  constructor() {
    this.initStatus();
    this.startBackgroundSync();
  }

  private initStatus(): void {
    if (!fs.existsSync(CONFIG.SYNC_STATUS_FILE)) {
      const initial: SyncStatus = {
        isSyncing: false,
        currentStage: 'Ready',
        progressPercent: 100,
        lastSyncedAt: new Date().toISOString(),
        recordsCount: adStore.getTotalCount(),
        newAdsCount: adStore.getTotalCount(),
        updatedAdsCount: 0,
        unchangedAdsCount: 0,
        deletedAdsCount: 0
      };
      fs.writeFileSync(CONFIG.SYNC_STATUS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
    }
  }

  public getStatus(): SyncStatus {
    try {
      if (fs.existsSync(CONFIG.SYNC_STATUS_FILE)) {
        const raw = fs.readFileSync(CONFIG.SYNC_STATUS_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        return {
          ...parsed,
          isSyncing: this.isSyncing,
          currentStage: this.currentStage,
          progressPercent: this.progressPercent,
          error: this.lastError || undefined
        };
      }
    } catch (err) {
      console.error('[SyncService] Error reading status:', err);
    }
    return {
      isSyncing: this.isSyncing,
      currentStage: this.currentStage,
      progressPercent: this.progressPercent,
      recordsCount: adStore.getTotalCount(),
      newAdsCount: 0,
      updatedAdsCount: 0,
      unchangedAdsCount: adStore.getTotalCount(),
      deletedAdsCount: 0
    };
  }

  public async triggerSync(sheetId: string = CONFIG.DEFAULT_SHEET_ID): Promise<SyncStatus> {
    if (this.isSyncing) {
      return this.getStatus();
    }

    this.isSyncing = true;
    this.currentStage = 'Connecting to Google Sheet...';
    this.progressPercent = 15;
    this.lastError = null;

    return new Promise((resolve) => {
      const scriptPath = path.resolve(__dirname, '../ingestion/ingest_sheets.py');
      console.log(`[SyncService] Starting sync for sheet ID: ${sheetId}...`);

      const py = spawn('python', [scriptPath], {
        cwd: path.resolve(__dirname, '../../..'),
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

          adStore.loadData();
          hybridSearchEngine.reindex();

          this.currentStage = 'Ready';
          this.progressPercent = 100;
          this.lastError = null;

          const updatedStatus: SyncStatus = {
            isSyncing: false,
            currentStage: 'Ready',
            progressPercent: 100,
            lastSyncedAt: new Date().toISOString(),
            recordsCount: adStore.getTotalCount(),
            newAdsCount: 0,
            updatedAdsCount: 0,
            unchangedAdsCount: adStore.getTotalCount(),
            deletedAdsCount: 0
          };
          fs.writeFileSync(CONFIG.SYNC_STATUS_FILE, JSON.stringify(updatedStatus, null, 2), 'utf-8');
          resolve(updatedStatus);
        } else {
          this.currentStage = 'Failed';
          this.progressPercent = 0;
          this.lastError = `Ingestion script exited with code ${code}`;
          console.error(`[SyncService] ${this.lastError}`);
          resolve(this.getStatus());
        }
      });
    });
  }

  private startBackgroundSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }
    this.syncTimer = setInterval(() => {
      console.log('[SyncService] Background sync scheduled check running...');
      this.triggerSync().catch(err => console.error('[SyncService] Auto sync error:', err));
    }, CONFIG.AUTO_SYNC_INTERVAL_MS);
  }
}

export const syncService = new SyncService();
