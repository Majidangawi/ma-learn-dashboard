import { google } from 'googleapis';

const sheetId = process.env.SHEET_ID;
const clientId = process.env.BACKEND_OAUTH_CLIENT_ID;
const clientSecret = process.env.BACKEND_OAUTH_CLIENT_SECRET;
const refreshToken = process.env.BACKEND_OAUTH_REFRESH_TOKEN;

if (!sheetId || !clientId || !clientSecret || !refreshToken) {
  console.error('Missing env: SHEET_ID / BACKEND_OAUTH_CLIENT_ID / BACKEND_OAUTH_CLIENT_SECRET / BACKEND_OAUTH_REFRESH_TOKEN');
  process.exit(1);
}

if (sheetId === '1nkrwK-KJ7nD2kv_8zdYiLqot6RFoH-v67VpmjCzvYi0') {
  throw new Error('Refusing to seed production sheet. Set SHEET_ID to staging copy.');
}

const oauth = new google.auth.OAuth2(clientId, clientSecret);
oauth.setCredentials({ refresh_token: refreshToken });
const sheets = google.sheets({ version: 'v4', auth: oauth });

const PRODUCTS = ['prompt-pack', 'intro-to-creative-ai', 'creative-ai-workshop-t3', 'beyond-lighting'] as const;
const PRICES: Record<string, number> = {
  'prompt-pack': 99,
  'intro-to-creative-ai': 499,
  'creative-ai-workshop-t3': 799,
  'beyond-lighting': 650,
};

const pad = (n: number) => n.toString().padStart(2, '0');
function isoDaysAgo(d: number): string {
  const t = new Date(Date.now() - d * 86400_000);
  return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}T${pad(t.getHours())}:${pad(t.getMinutes())}:00`;
}

function token(): string {
  const chars = '0123456789ABCDEF';
  let t = 'MAL-';
  for (let i = 0; i < 8; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

// NOTE: Column order below assumes Customers = [Email, Name, Product, AmountSAR, PurchasedAt, Token, Source]
// and Tokens = [Token, Product, Email, Status, AssignedAt]. Operator must run verify-prod-schema.ts first
// to confirm actual column order and reorder the arrays below if they differ.
const customers: string[][] = [];
const tokens: string[][] = [];
for (let i = 0; i < 50; i++) {
  const product = PRODUCTS[i % PRODUCTS.length];
  const email = `fake${i + 1}@staging.test`;
  const name = `Test Buyer ${i + 1}`;
  const t = token();
  const daysAgo = Math.floor(Math.random() * 30);
  customers.push([email, name, product, String(PRICES[product]), isoDaysAgo(daysAgo), t, 'STAGING']);
  tokens.push([t, product, email, 'used', isoDaysAgo(daysAgo)]);
}

await sheets.spreadsheets.values.append({
  spreadsheetId: sheetId,
  range: 'Customers!A1',
  valueInputOption: 'RAW',
  requestBody: { values: customers },
});

await sheets.spreadsheets.values.append({
  spreadsheetId: sheetId,
  range: 'Tokens!A1',
  valueInputOption: 'RAW',
  requestBody: { values: tokens },
});

console.log(`Seeded ${customers.length} customers and ${tokens.length} tokens into staging sheet ${sheetId}`);
