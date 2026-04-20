import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import { loadConfig } from './config.js';
import { registerEnvBadge } from './env-badge.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { meRoutes } from './routes/me.js';
import { noorRoutes } from './routes/noor.js';
import { dataRoutes } from './routes/data.js';
import { writesRoutes } from './routes/writes.js';
import writesUploadRoute from './routes/writes-upload.js';
import webhooksRoute from './routes/webhooks.js';
import publicRoute from './routes/public.js';
import { registerAuthGuard } from './auth/middleware.js';
import { makeEmailAssetsUploader } from './drive/upload.js';
import { createAppsScriptClient } from './apps-script/client.js';

export async function buildServer() {
  const config = loadConfig();
  const app = Fastify({ logger: { level: 'info' } });

  await app.register(cookie, { secret: config.JWT_SECRET });

  // CORS policy:
  //   /api/public/* — any origin (public linkbio page served from linkinbio.malearnsa.com etc.)
  //   /api/*        — only dashboard frontend origins (credentialed requests with session cookie)
  const PUBLIC_ORIGINS = new Set([
    'https://linkinbio.malearnsa.com',
    'https://linkinbio-staging.malearnsa.com',
    'https://link.malearnsa.com',
    'https://link-staging.malearnsa.com',
    'https://malearnsa.com',
    'https://www.malearnsa.com',
  ]);
  await app.register(cors, {
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (origin === config.FRONTEND_ORIGIN) return cb(null, true);
      if (PUBLIC_ORIGINS.has(origin)) return cb(null, true);
      cb(null, false);
    },
  });

  registerEnvBadge(app, config);
  registerAuthGuard(app, config);
  await healthRoutes(app, config);
  await authRoutes(app, config);
  await meRoutes(app);
  await noorRoutes(app, config);
  if (config.SHEET_ID) {
    await dataRoutes(app, config);
  }
  if (config.SHEET_ID && config.APPS_SCRIPT_URL) {
    await writesRoutes(app, config);
  }
  // Image upload route for the newsletter composer. Global auth guard already
  // blocks unauthenticated /api/* traffic; `requireAuth` here just surfaces the
  // authenticated user to the plugin (and keeps the handler unit-testable).
  await app.register(writesUploadRoute, {
    drive: { upload: makeEmailAssetsUploader(config) },
    requireAuth: (req) => {
      const u = (req as unknown as { user?: { email?: string } }).user;
      return u?.email ?? null;
    },
  });
  await app.register(webhooksRoute, { brevoSecret: process.env.BREVO_WEBHOOK_SECRET ?? '' });

  if (config.APPS_SCRIPT_URL) {
    const appsScript = createAppsScriptClient({
      url: config.APPS_SCRIPT_URL,
      adminToken: config.APPS_SCRIPT_ADMIN_TOKEN,
    });
    await app.register(publicRoute, { appsScript, rateLimit: { max: 5, windowMs: 10 * 60_000 } });
  }

  return app;
}

// Listen when run as the process entry (pm2, `node server.js`, or `tsx server.ts`).
// Skip when imported by vitest — vitest sets VITEST=true automatically.
if (!process.env.VITEST) {
  const app = await buildServer();
  const port = Number(process.env.PORT ?? 3400);
  await app.listen({ port, host: '0.0.0.0' });
  app.log.info(`listening on ${port} in ${process.env.NODE_ENV} mode`);
}
