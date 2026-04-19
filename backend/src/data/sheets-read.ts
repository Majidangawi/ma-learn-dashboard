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
