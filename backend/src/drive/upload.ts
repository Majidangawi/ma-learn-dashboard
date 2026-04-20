import { Readable } from 'node:stream';
import { google } from 'googleapis';
import type { Config } from '../config.js';

// TODO(ops): Majid to create a dedicated `MA Learn / Email Assets` folder in
// the malearnsa.com Drive, then set `EMAIL_ASSETS_FOLDER_ID=<folder-id>` in
// /etc/ma-learn-dashboard/.env.staging on the droplet and `pm2 restart
// ma-learn-dashboard-staging --update-env`. Until that env var is set, uploads
// land in the OAuth user's root Drive — they still resolve to a public URL,
// just without monthly grouping.

/**
 * Builds a Drive v3 client using the same OAuth refresh-token that powers
 * `createSheetsClient` (service-account keys are blocked by org policy).
 */
function createDriveAuth(config: Config) {
  const oauth = new google.auth.OAuth2(
    config.BACKEND_OAUTH_CLIENT_ID,
    config.BACKEND_OAUTH_CLIENT_SECRET,
  );
  oauth.setCredentials({ refresh_token: config.BACKEND_OAUTH_REFRESH_TOKEN });
  return oauth;
}

export interface UploadArgs {
  filename: string;
  contentType: string;
  data: Buffer;
}

export interface UploadResult {
  url: string;
}

/**
 * Uploads a single file into the configured `EMAIL_ASSETS_FOLDER_ID` (when
 * set), makes it publicly readable so inbox clients can load it inline, and
 * returns a stable public URL (`https://drive.google.com/uc?id=<id>`).
 *
 * Called from the writes-upload route; composer posts base64 JSON.
 */
export function makeEmailAssetsUploader(config: Config) {
  const auth = createDriveAuth(config);
  const drive = google.drive({ version: 'v3', auth });
  const folderId = process.env.EMAIL_ASSETS_FOLDER_ID ?? '';

  return async function uploadToEmailAssets(args: UploadArgs): Promise<UploadResult> {
    const today = new Date();
    const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
    const finalName = `${Date.now()}-${args.filename}`;

    const res = await drive.files.create({
      requestBody: {
        name: finalName,
        parents: folderId ? [folderId] : undefined,
        properties: { month: yearMonth },
      },
      media: {
        mimeType: args.contentType,
        body: Readable.from(args.data),
      },
      fields: 'id, webViewLink, webContentLink',
    });

    const fileId = res.data.id;
    if (!fileId) throw new Error('drive_upload_no_id');

    // Newsletter / email images must load in the recipient's inbox, which
    // requires anyone-with-the-link read access.
    await drive.permissions.create({
      fileId,
      requestBody: { role: 'reader', type: 'anyone' },
    });

    return { url: `https://drive.google.com/uc?id=${fileId}` };
  };
}
