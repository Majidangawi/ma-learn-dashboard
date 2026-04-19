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
import { registerAuthGuard } from './auth/middleware.js';

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
