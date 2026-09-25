/**
 * Server-Side Google Sheets Reader Service
 * Runs inside Netlify Functions backend to protect API keys & service accounts.
 * Supports:
 * 1. Google Cloud Service Account (for Private Google Sheets shared with service account email)
 * 2. Google Cloud API Key (for public sheets via API v4)
 * 3. Public Export CSV (zero-config fallback)
 */

import * as crypto from 'crypto';

export interface ServerTabDiscovery {
  spreadsheetId: string;
  spreadsheetTitle?: string;
  tabs: {
    sheetId: string;
    title: string;
    headers?: string[];
    sampleRows?: Record<string, any>[];
  }[];
}

export function extractSpreadsheetId(url: string): string | null {
  if (!url) return null;
  const match =
    url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/i) ||
    url.match(/key=([a-zA-Z0-9-_]+)/i) ||
    url.match(/^([a-zA-Z0-9-_]{20,})$/);
  return match ? match[1] : null;
}

// In-memory token cache to avoid regenerating on every row batch
let cachedAccessToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Generates an OAuth2 Access Token using Google Service Account credentials via Node crypto (Zero external dependencies)
 */
export async function getGoogleServiceAccountToken(): Promise<string | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '';
  let privateKey = process.env.GOOGLE_PRIVATE_KEY || '';

  // Also support JSON credentials object in GOOGLE_SERVICE_ACCOUNT_KEY
  if (!email && process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY);
      if (parsed.client_email && parsed.private_key) {
        return getAccessTokenFromCredentials(parsed.client_email, parsed.private_key);
      }
    } catch (e) {
      console.warn('Failed to parse GOOGLE_SERVICE_ACCOUNT_KEY JSON:', e);
    }
  }

  if (!email || !privateKey) {
    return null;
  }

  return getAccessTokenFromCredentials(email, privateKey);
}

async function getAccessTokenFromCredentials(email: string, rawPrivateKey: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && tokenExpiresAt > now + 60) {
    return cachedAccessToken;
  }

  try {
    // Handle escaped newlines (e.g. from Netlify UI or .env where \n is a literal string)
    const privateKey = rawPrivateKey.replace(/\\n/g, '\n');

    // 1. Build JWT Header & Claims
    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const claimSet = {
      iss: email,
      scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now,
    };

    const base64UrlEncode = (str: string) =>
      Buffer.from(str)
        .toString('base64')
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    const encodedHeader = base64UrlEncode(JSON.stringify(header));
    const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
    const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

    // 2. Sign JWT using Node.js built-in crypto
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(signatureInput);
    signer.end();
    const signature = signer.sign(privateKey, 'base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');

    const jwt = `${signatureInput}.${signature}`;

    // 3. Exchange JWT for Google OAuth2 Access Token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error('Google OAuth token exchange failed:', tokenRes.status, errText);
      return null;
    }

    const tokenData = await tokenRes.json();
    cachedAccessToken = tokenData.access_token;
    tokenExpiresAt = now + (tokenData.expires_in || 3600);
    return cachedAccessToken;
  } catch (err) {
    console.error('Error generating Google Service Account token:', err);
    return null;
  }
}

function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          currentVal += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\r') {
        // Skip CR
      } else if (char === '\n') {
        row.push(currentVal.trim());
        if (row.some((c) => c.length > 0)) {
          lines.push(row);
        }
        row = [];
        currentVal = '';
      } else {
        currentVal += char;
      }
    }
  }

  if (currentVal || row.length > 0) {
    row.push(currentVal.trim());
    if (row.some((c) => c.length > 0)) {
      lines.push(row);
    }
  }

  return lines;
}

/**
 * Discover tabs from Google Sheets (via Service Account, API key, or public fallback)
 */
export async function discoverTabsServer(spreadsheetUrlOrId: string): Promise<ServerTabDiscovery> {
  const spreadsheetId = extractSpreadsheetId(spreadsheetUrlOrId);
  if (!spreadsheetId) {
    throw new Error('INVALID_SOURCE_URL: Invalid Google Sheets URL or ID format.');
  }

  // Approach 1: Google Service Account (Private Sheets Access)
  const token = await getGoogleServiceAccountToken();
  if (token) {
    try {
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
      const metaRes = await fetch(metaUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (metaRes.ok) {
        const metaData = await metaRes.json();
        const tabs = (metaData.sheets || []).map((s: any) => ({
          sheetId: String(s.properties.sheetId),
          title: s.properties.title,
        }));

        // Fetch sample rows for tabs
        if (tabs.length > 0) {
          try {
            const firstTab = tabs[0];
            const rangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
              firstTab.title
            )}!A1:ZZ15`;
            const rangeRes = await fetch(rangeUrl, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (rangeRes.ok) {
              const rangeData = await rangeRes.json();
              const values = rangeData.values || [];
              if (values.length > 0) {
                const headers = values[0];
                const sampleRows = values.slice(1).map((r: string[]) => {
                  const obj: Record<string, any> = {};
                  headers.forEach((h: string, idx: number) => {
                    obj[h] = r[idx] || '';
                  });
                  return obj;
                });
                firstTab.headers = headers;
                firstTab.sampleRows = sampleRows;
              }
            }
          } catch (e) {
            console.warn('Failed to fetch sample rows via Service Account:', e);
          }
        }

        return {
          spreadsheetId,
          spreadsheetTitle: metaData.properties?.title || 'Google Sheet',
          tabs,
        };
      } else if (metaRes.status === 403 || metaRes.status === 404) {
        throw new Error(
          `ACCESS_DENIED: Service account does not have access. Please share the Google Spreadsheet with "${process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL}" as Viewer.`
        );
      }
    } catch (err: any) {
      if (err.message?.includes('ACCESS_DENIED')) throw err;
      console.warn('Service account request failed, attempting alternative approaches:', err);
    }
  }

  // Approach 2: Google Cloud API Key
  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey) {
    try {
      const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;
      const metaRes = await fetch(metaUrl);
      if (metaRes.ok) {
        const metaData = await metaRes.json();
        const tabs = (metaData.sheets || []).map((s: any) => ({
          sheetId: String(s.properties.sheetId),
          title: s.properties.title,
        }));

        return {
          spreadsheetId,
          spreadsheetTitle: metaData.properties?.title || 'Google Sheet',
          tabs,
        };
      }
    } catch (apiErr) {
      console.warn('Google Sheets API v4 request failed, falling back to public export:', apiErr);
    }
  }

  // Approach 3: Public Export / GViz reader
  try {
    const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv`;
    const resp = await fetch(csvUrl);
    if (!resp.ok) {
      throw new Error(`Google Sheets returned HTTP ${resp.status}. Please check permissions.`);
    }

    const text = await resp.text();
    const rows = parseCSV(text);
    if (rows.length === 0) {
      throw new Error('SPREADSHEET_NOT_FOUND: Spreadsheet is empty or unreachable.');
    }

    const headers = rows[0];
    const sampleRows = rows.slice(1, 15).map((r) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] || '';
      });
      return obj;
    });

    return {
      spreadsheetId,
      tabs: [
        {
          sheetId: '0',
          title: 'Sheet1',
          headers,
          sampleRows,
        },
      ],
    };
  } catch (err: any) {
    throw new Error(
      err.message ||
        'ACCESS_DENIED: Ensure either GOOGLE_SERVICE_ACCOUNT_EMAIL is configured and shared, or sheet is set to "Anyone with link can view".'
    );
  }
}

/**
 * Fetch rows for a specific tab
 */
export async function readTabRowsServer(
  spreadsheetId: string,
  tabTitleOrGid: string
): Promise<{ headers: string[]; rows: Record<string, any>[] }> {
  // 1. Service Account Access
  const token = await getGoogleServiceAccountToken();
  if (token && !/^\d+$/.test(tabTitleOrGid)) {
    try {
      const rangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        tabTitleOrGid
      )}!A1:ZZ`;
      const res = await fetch(rangeUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const values = data.values || [];
        if (values.length === 0) return { headers: [], rows: [] };
        const headers = values[0];
        const rows = values.slice(1).map((r: string[]) => {
          const obj: Record<string, any> = {};
          headers.forEach((h: string, idx: number) => {
            obj[h] = r[idx] || '';
          });
          return obj;
        });
        return { headers, rows };
      }
    } catch (e) {
      console.warn('Service account range read failed, trying alternative:', e);
    }
  }

  // 2. API Key Access
  const apiKey = process.env.GOOGLE_API_KEY;
  if (apiKey && !/^\d+$/.test(tabTitleOrGid)) {
    try {
      const rangeUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
        tabTitleOrGid
      )}!A1:ZZ?key=${apiKey}`;
      const res = await fetch(rangeUrl);
      if (res.ok) {
        const data = await res.json();
        const values = data.values || [];
        if (values.length === 0) return { headers: [], rows: [] };
        const headers = values[0];
        const rows = values.slice(1).map((r: string[]) => {
          const obj: Record<string, any> = {};
          headers.forEach((h: string, idx: number) => {
            obj[h] = r[idx] || '';
          });
          return obj;
        });
        return { headers, rows };
      }
    } catch (e) {
      console.warn('Google Sheets API range read failed, trying gviz fallback:', e);
    }
  }

  // 3. Public Export Fallback
  let queryParam = '';
  if (/^\d+$/.test(tabTitleOrGid)) {
    queryParam = `&gid=${tabTitleOrGid}`;
  } else if (tabTitleOrGid && tabTitleOrGid !== 'Sheet1') {
    queryParam = `&sheet=${encodeURIComponent(tabTitleOrGid)}`;
  }

  const csvUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv${queryParam}`;
  const resp = await fetch(csvUrl);

  if (!resp.ok) {
    const fallbackUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv${queryParam}`;
    const fallbackResp = await fetch(fallbackUrl);
    if (!fallbackResp.ok) {
      throw new Error(`TAB_NOT_FOUND: Failed to read tab ${tabTitleOrGid} (HTTP ${resp.status})`);
    }
    const text = await fallbackResp.text();
    const rows = parseCSV(text);
    if (rows.length === 0) return { headers: [], rows: [] };
    const headers = rows[0];
    const dataRows = rows.slice(1).map((r) => {
      const obj: Record<string, any> = {};
      headers.forEach((h, idx) => {
        obj[h] = r[idx] || '';
      });
      return obj;
    });
    return { headers, rows: dataRows };
  }

  const text = await resp.text();
  const rows = parseCSV(text);
  if (rows.length === 0) return { headers: [], rows: [] };
  const headers = rows[0];
  const dataRows = rows.slice(1).map((r) => {
    const obj: Record<string, any> = {};
    headers.forEach((h, idx) => {
      obj[h] = r[idx] || '';
    });
    return obj;
  });

  return { headers, rows: dataRows };
}
