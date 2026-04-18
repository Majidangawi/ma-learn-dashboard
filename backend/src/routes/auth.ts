import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Config } from '../config.js';
import { verifyGoogleIdToken } from '../auth/google.js';
import { verifyPassword } from '../auth/password.js';
import { issueSession } from '../auth/session.js';

const loginSchema = z.object({
  googleIdToken: z.string().min(10),
  password: z.string().min(1),
});

export async function authRoutes(app: FastifyInstance, config: Config): Promise<void> {
  app.post('/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const { email, emailVerified } = await verifyGoogleIdToken(
      config.GOOGLE_OAUTH_CLIENT_ID,
      body.googleIdToken,
    );
    if (!emailVerified || email !== config.ALLOWED_ADMIN_EMAIL) {
      return reply.code(403).send({ error: 'not_allowed' });
    }
    if (!config.PASSWORD_HASH) {
      return reply.code(500).send({ error: 'password_not_configured' });
    }
    const ok = await verifyPassword(body.password, config.PASSWORD_HASH);
    if (!ok) return reply.code(401).send({ error: 'bad_password' });

    const token = await issueSession(config.JWT_SECRET, { email });
    reply.setCookie('session', token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });
    return { ok: true };
  });

  app.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie('session', { path: '/' });
    return { ok: true };
  });
}
