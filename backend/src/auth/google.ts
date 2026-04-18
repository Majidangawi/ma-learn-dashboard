import { OAuth2Client } from 'google-auth-library';

export async function verifyGoogleIdToken(
  clientId: string,
  idToken: string,
): Promise<{ email: string; emailVerified: boolean }> {
  const client = new OAuth2Client(clientId);
  const ticket = await client.verifyIdToken({ idToken, audience: clientId });
  const p = ticket.getPayload();
  if (!p || !p.email) throw new Error('google token missing email');
  return { email: p.email, emailVerified: Boolean(p.email_verified) };
}
