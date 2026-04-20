import { google } from 'googleapis';
import type { SheetsClient } from './sheets-client.js';

export interface Customer {
  email: string;
  name: string;
  product: string;
  amountSAR: number;
  purchasedAt: string;
  token: string;
  source: string;
}

function pickIndex(header: string[], ...candidates: string[]): number {
  for (const c of candidates) {
    const i = header.indexOf(c);
    if (i >= 0) return i;
  }
  return -1;
}

export function parseCustomers(rows: string[][] | undefined): Customer[] {
  if (!rows || rows.length < 2) return [];
  const [header, ...data] = rows;
  const iEmail = header.indexOf('Email');
  const iName = header.indexOf('Name');
  const iProduct = header.indexOf('Product');
  const iAmount = pickIndex(header, 'AmountSAR', 'Amount (SAR)', 'Amount');
  const iPurchased = pickIndex(header, 'PurchasedAt', 'Date');
  const iToken = header.indexOf('Token');
  const iSource = header.indexOf('Source');
  return data
    .filter((r) => r[iEmail])
    .map((r) => ({
      email: r[iEmail] ?? '',
      name: r[iName] ?? '',
      product: r[iProduct] ?? '',
      amountSAR: Number(r[iAmount] ?? 0),
      purchasedAt: iPurchased >= 0 ? (r[iPurchased] ?? '') : '',
      token: iToken >= 0 ? (r[iToken] ?? '') : '',
      source: iSource >= 0 ? (r[iSource] ?? '') : '',
    }));
}

export async function readCustomers(sheets: SheetsClient, sheetId: string): Promise<Customer[]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Customers' });
  return parseCustomers(res.data.values as string[][] | undefined);
}

/**
 * Generic tab reader. Returns each row as an object keyed by the header row.
 * Builds its own Sheets client from env vars so it can be called from scripts
 * and data modules without plumbing a client through.
 *
 * Required env: SHEET_ID, BACKEND_OAUTH_CLIENT_ID, BACKEND_OAUTH_CLIENT_SECRET,
 *               BACKEND_OAUTH_REFRESH_TOKEN.
 */
export type SheetRow = Record<string, string>;

export async function readSheet(opts: { tab: string }): Promise<SheetRow[]> {
  const clientId = process.env.BACKEND_OAUTH_CLIENT_ID;
  const clientSecret = process.env.BACKEND_OAUTH_CLIENT_SECRET;
  const refresh = process.env.BACKEND_OAUTH_REFRESH_TOKEN;
  const sheetId = process.env.SHEET_ID;
  if (!clientId || !clientSecret || !refresh || !sheetId) {
    throw new Error('readSheet: missing env (SHEET_ID / BACKEND_OAUTH_*)');
  }
  const oauth = new google.auth.OAuth2(clientId, clientSecret);
  oauth.setCredentials({ refresh_token: refresh });
  const sheets = google.sheets({ version: 'v4', auth: oauth });
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: opts.tab });
  const values = (res.data.values ?? []) as string[][];
  return rowsToObjects(values);
}

export function rowsToObjects(values: string[][] | undefined): SheetRow[] {
  if (!values || values.length < 2) return [];
  const [header, ...rows] = values;
  return rows.map(r => {
    const o: SheetRow = {};
    for (let i = 0; i < header.length; i++) {
      o[header[i]!] = r[i] ?? '';
    }
    return o;
  });
}
