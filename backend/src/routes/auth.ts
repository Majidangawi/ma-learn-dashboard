import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Config } from '../config.js';
import { verifyGoogleIdToken } from '../auth/google.js';
import { verifyPassword, hashPassword } from '../auth/password.js';
import { issueSession } from '../auth/session.js';
import { buildResetToken, verifyResetToken, sendResetEmail } from '../auth/forgot-password.js';

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

  app.post('/auth/forgot', async (req, reply) => {
    const body = z.object({ email: z.string().email() }).parse(req.body);

    // Don't reveal whether the email is the admin. Silently succeed on any input.
    if (body.email !== config.ALLOWED_ADMIN_EMAIL) {
      return { ok: true };
    }

    const token = await buildResetToken(config.JWT_SECRET, body.email);
    const link = `${config.FRONTEND_ORIGIN}/reset.html?t=${encodeURIComponent(token)}`;

    await sendResetEmail(
      {
        clientId: config.BACKEND_OAUTH_CLIENT_ID,
        clientSecret: config.BACKEND_OAUTH_CLIENT_SECRET,
        refreshToken: config.BACKEND_OAUTH_REFRESH_TOKEN,
        sender: config.GMAIL_SENDER,
      },
      body.email,
      link,
    );
    return { ok: true };
  });

  app.post('/auth/reset', async (req, reply) => {
    const body = z.object({
      token: z.string(),
      newPassword: z.string().min(10),
    }).parse(req.body);

    const email = await verifyResetToken(config.JWT_SECRET, body.token);
    if (email !== config.ALLOWED_ADMIN_EMAIL) {
      return reply.code(403).send({ error: 'not_allowed' });
    }

    // Plan 1 note: we don't yet rewrite the .env.staging on disk from inside
    // the container — that requires a separate deploy mechanism (Plan 2).
    // Return the new hash so the admin can manually update /etc/ma-learn-dashboard/.env.staging
    // and `pm2 reload` the process. The reset token is single-use (time-limited).
    const newHash = await hashPassword(body.newPassword);
    return {
      ok: true,
      newPasswordHash: newHash,
      note: 'Update PASSWORD_HASH in .env.staging on the droplet, then pm2 reload ma-learn-dashboard-staging',
    };
  });
}
