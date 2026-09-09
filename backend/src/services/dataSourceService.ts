import fs from 'fs';
import { CONFIG } from '../config';
import { DataSource } from '../types';

export class DataSourceService {
  private sources: DataSource[] = [];

  constructor() {
    this.loadSources();
  }

  private loadSources(): void {
    try {
      if (fs.existsSync(CONFIG.DATA_SOURCES_FILE)) {
        const raw = fs.readFileSync(CONFIG.DATA_SOURCES_FILE, 'utf-8');
        this.sources = JSON.parse(raw);
      } else {
        // Default primary sheet
        this.sources = [
          {
            id: 'source_primary',
            name: CONFIG.DEFAULT_SHEET_NAME,
            url: CONFIG.DEFAULT_SHEET_URL,
            sheetId: CONFIG.DEFAULT_SHEET_ID,
            status: 'active',
            lastSyncedAt: new Date().toISOString(),
            recordCount: 8285,
            tabs: ['Google Ads', 'Meta Ads', 'Insta reel research', 'Linkedin ad research']
          }
        ];
        this.saveSources();
      }
    } catch (err) {
      console.error('[DataSourceService] Error loading sources:', err);
      this.sources = [];
    }
  }

  private saveSources(): void {
    try {
      fs.writeFileSync(CONFIG.DATA_SOURCES_FILE, JSON.stringify(this.sources, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DataSourceService] Error saving sources:', err);
    }
  }

  public getSources(): DataSource[] {
    return this.sources;
  }

  public extractSheetId(urlOrId: string): string | null {
    if (!urlOrId) return null;
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

  public addSource(name: string, url: string): { success: boolean; source?: DataSource; error?: string } {
    const sheetId = this.extractSheetId(url);
    if (!sheetId) {
      return { success: false, error: 'Invalid Google Sheet URL or ID format.' };
    }

    // Check if already exists
    const existing = this.sources.find(s => s.sheetId === sheetId);
    if (existing) {
      return { success: false, error: 'This Google Sheet is already connected as a data source.' };
    }

    const newSource: DataSource = {
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

export const dataSourceService = new DataSourceService();
