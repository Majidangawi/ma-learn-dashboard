import { SignJWT, jwtVerify } from 'jose';

const alg = 'HS256';
const EXPIRES_IN = '30d';

export interface SessionPayload {
  email: string;
}

export async function issueSession(secret: string, payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(new TextEncoder().encode(secret));
}

export async function verifySession(secret: string, token: string): Promise<SessionPayload> {
  const { payload } = await jwtVerify(token, new TextEncoder().encode(secret));
  if (typeof payload.email !== 'string') throw new Error('invalid session payload');
  return { email: payload.email };
}
