import { google, type sheets_v4 } from 'googleapis';
import type { Config } from '../config.js';

export type SheetsClient = sheets_v4.Sheets;

/**
 * Builds a Google Sheets API client using OAuth user credentials
 * (acting as GMAIL_SENDER via a refresh token). Replaces the legacy
 * service-account-JSON approach — that path is blocked by the
 * malearnsa.com Workspace org policy on service account key creation.
 */
export async function createSheetsClient(config: Config): Promise<SheetsClient> {
  const oauth = new google.auth.OAuth2(
    config.BACKEND_OAUTH_CLIENT_ID,
    config.BACKEND_OAUTH_CLIENT_SECRET,
  );
  oauth.setCredentials({ refresh_token: config.BACKEND_OAUTH_REFRESH_TOKEN });
  return google.sheets({ version: 'v4', auth: oauth });
}
