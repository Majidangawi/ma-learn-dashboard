import { SignJWT, jwtVerify } from 'jose';
import { google } from 'googleapis';

const alg = 'HS256';

/**
 * Build a short-lived reset token. Default TTL = 15 minutes.
 * The token embeds the email + a `purpose: 'reset'` claim so it
 * can't be confused with a session token.
 */
export async function buildResetToken(
  secret: string,
  email: string,
  ttlSeconds: number = 900,
): Promise<string> {
  return new SignJWT({ email, purpose: 'reset' })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + Math.max(1, ttlSeconds))
    .sign(new TextEncoder().encode(secret));
}

export async function verifyResetToken(secret: string, token: string): Promise<string> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  if (payload.purpose !== 'reset' || typeof payload.email !== 'string') {
    throw new Error('invalid reset token');
  }
  return payload.email;
}

/**
 * Send a reset email via Gmail API using the shared backend OAuth credentials.
 * Same refresh token that authorizes Sheets access also authorizes gmail.send,
 * because the Desktop OAuth client was consented with both scopes.
 */
export async function sendResetEmail(
  opts: {
    clientId: string;
    clientSecret: string;
    refreshToken: string;
    sender: string;
  },
  to: string,
  resetLink: string,
): Promise<void> {
  const oauth = new google.auth.OAuth2(opts.clientId, opts.clientSecret);
  oauth.setCredentials({ refresh_token: opts.refreshToken });
  const gmail = google.gmail({ version: 'v1', auth: oauth });
  const subject = 'Dashboard password reset';
  const body = `Click this link to reset your dashboard password. It expires in 15 minutes.\n\n${resetLink}\n\nIf you didn't request this, ignore this email.`;
  const raw = Buffer.from(
    [`From: ${opts.sender}`, `To: ${to}`, `Subject: ${subject}`, '', body].join('\r\n'),
  ).toString('base64url');
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}
