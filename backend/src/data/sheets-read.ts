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

export function parseCustomers(rows: string[][] | undefined): Customer[] {
  if (!rows || rows.length < 2) return [];
  const [header, ...data] = rows;
  const iEmail = header.indexOf('Email');
  const iName = header.indexOf('Name');
  const iProduct = header.indexOf('Product');
  const iAmount = header.indexOf('AmountSAR');
  const iPurchased = header.indexOf('PurchasedAt');
  const iToken = header.indexOf('Token');
  const iSource = header.indexOf('Source');
  return data
    .filter((r) => r[iEmail])
    .map((r) => ({
      email: r[iEmail] ?? '',
      name: r[iName] ?? '',
      product: r[iProduct] ?? '',
      amountSAR: Number(r[iAmount] ?? 0),
      purchasedAt: r[iPurchased] ?? '',
      token: r[iToken] ?? '',
      source: r[iSource] ?? '',
    }));
}

export async function readCustomers(sheets: SheetsClient, sheetId: string): Promise<Customer[]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: 'Customers' });
  return parseCustomers(res.data.values as string[][] | undefined);
}
