#!/usr/bin/env node
// Obtains a refresh token for the dashboard backend with combined
// Sheets + Gmail scopes, acting as majid@malearnsa.com.
//
// Usage:
//   cd ~/code/ma-learn-dashboard
//   node scripts/get-backend-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>

import { google } from 'googleapis';
import http from 'node:http';
import { URL } from 'node:url';

const [, , clientId, clientSecret] = process.argv;

if (!clientId || !clientSecret) {
  console.error('Usage: node scripts/get-backend-refresh-token.mjs <CLIENT_ID> <CLIENT_SECRET>');
  process.exit(1);
}

const PORT = 8787;
const redirectUri = `http://localhost:${PORT}/callback`;
const oauth = new google.auth.OAuth2(clientId, clientSecret, redirectUri);

const authUrl = oauth.generateAuthUrl({
  access_type: 'offline',
  prompt: 'consent',
  scope: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/gmail.send',
  ],
});

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname !== '/callback') {
      res.writeHead(404).end();
      return;
    }
    const code = url.searchParams.get('code');
    const err = url.searchParams.get('error');
    if (err) {
      res.writeHead(400, { 'content-type': 'text/html' });
      res.end(`<h1>Error: ${err}</h1>`);
      console.error('\n❌ Google returned an error:', err);
      server.close();
      return;
    }
    if (!code) {
      res.writeHead(400).end('No code in callback');
      return;
    }
    const { tokens } = await oauth.getToken(code);
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end('<!doctype html><html><body style="font-family:system-ui;padding:40px"><h1>Done ✓</h1><p>You can close this tab and return to the terminal.</p></body></html>');
    console.log('\n✅ Refresh token:\n');
    console.log(tokens.refresh_token);
    console.log('\nSave this as GMAIL_REFRESH_TOKEN (works for Sheets + Gmail).\n');
    server.close();
  } catch (e) {
    console.error('\n❌ Error:', e.message);
    try { res.writeHead(500).end(String(e)); } catch {}
  }
});

server.listen(PORT, () => {
  console.log(`\nLocal server listening on http://localhost:${PORT}`);
  console.log('\n🔗 Open this URL in a browser logged in as majid@malearnsa.com:\n');
  console.log(authUrl);
  console.log('\nAfter you approve consent, the token will print here automatically.\n');
});
