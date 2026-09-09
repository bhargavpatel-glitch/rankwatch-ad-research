import path from 'path';

export const CONFIG = {
  PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
  DATA_DIR: path.resolve(__dirname, '../../data'),
  ADS_FILE: path.resolve(__dirname, '../../data/ads.json'),
  DATA_SOURCES_FILE: path.resolve(__dirname, '../../data/sources.json'),
  SYNC_STATUS_FILE: path.resolve(__dirname, '../../data/sync_status.json'),
  DEFAULT_SHEET_ID: '1tZxJhQufqVprwcZeUgeu6MBgsxJbHXWXPdz_DQmVejc',
  DEFAULT_SHEET_URL: 'https://docs.google.com/spreadsheets/d/1tZxJhQufqVprwcZeUgeu6MBgsxJbHXWXPdz_DQmVejc/edit?usp=sharing',
  DEFAULT_SHEET_NAME: 'Primary Ad Intelligence Source',
  AUTO_SYNC_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes background sync
};
