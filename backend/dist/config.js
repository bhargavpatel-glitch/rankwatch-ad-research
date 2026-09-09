"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CONFIG = void 0;
const path_1 = __importDefault(require("path"));
exports.CONFIG = {
    PORT: process.env.PORT ? parseInt(process.env.PORT, 10) : 3001,
    DATA_DIR: path_1.default.resolve(__dirname, '../../data'),
    ADS_FILE: path_1.default.resolve(__dirname, '../../data/ads.json'),
    DATA_SOURCES_FILE: path_1.default.resolve(__dirname, '../../data/sources.json'),
    SYNC_STATUS_FILE: path_1.default.resolve(__dirname, '../../data/sync_status.json'),
    DEFAULT_SHEET_ID: '1tZxJhQufqVprwcZeUgeu6MBgsxJbHXWXPdz_DQmVejc',
    DEFAULT_SHEET_URL: 'https://docs.google.com/spreadsheets/d/1tZxJhQufqVprwcZeUgeu6MBgsxJbHXWXPdz_DQmVejc/edit?usp=sharing',
    DEFAULT_SHEET_NAME: 'Primary Ad Intelligence Source',
    AUTO_SYNC_INTERVAL_MS: 5 * 60 * 1000 // 5 minutes background sync
};
