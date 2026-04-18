import { google } from 'googleapis';

const sheetId = process.env.SHEET_ID;
const clientId = process.env.BACKEND_OAUTH_CLIENT_ID;
const clientSecret = process.env.BACKEND_OAUTH_CLIENT_SECRET;
const refreshToken = process.env.BACKEND_OAUTH_REFRESH_TOKEN;

if (!sheetId || !clientId || !clientSecret || !refreshToken) {
  console.error('Missing env: SHEET_ID / BACKEND_OAUTH_CLIENT_ID / BACKEND_OAUTH_CLIENT_SECRET / BACKEND_OAUTH_REFRESH_TOKEN');
  process.exit(1);
}

const oauth = new google.auth.OAuth2(clientId, clientSecret);
oauth.setCredentials({ refresh_token: refreshToken });
const sheets = google.sheets({ version: 'v4', auth: oauth });

const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId });
for (const sheet of meta.data.sheets ?? []) {
  const title = sheet.properties?.title;
  if (!title) continue;
  const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${title}!1:1` });
  console.log(title, '→', JSON.stringify(r.data.values?.[0] ?? []));
}
