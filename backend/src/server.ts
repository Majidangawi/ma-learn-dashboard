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
import newsletterWelcomeRoute from './routes/newsletter-welcome.js';
import newslettersRoute from './routes/newsletters.js';
import contactsRoute from './routes/contacts.js';
import lessonsReadRoute from './routes/lessons-read.js';
import activityRoute from './routes/activity.js';
import homeKpisRoute from './routes/home-kpis.js';
import { readTokens } from './data/read-extra.js';
import writesContactRoute from './routes/writes-contact.js';
import writesLessonRoute from './routes/writes-lesson.js';
import { invalidateContactsCache } from './data/contacts.js';
import { invalidateLessonsCache } from './data/lessons.js';
import { readRecentActivity } from './data/audit-log.js';
import { createSheetsClient } from './data/sheets-client.js';
import { registerAuthGuard } from './auth/middleware.js';
import { makeEmailAssetsUploader } from './drive/upload.js';
import { createAppsScriptClient } from './apps-script/client.js';
import { startScheduler } from './workers/scheduler.js';

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

  // Shared Apps Script client for webhook dispatch, public subscribe, and the
  // newsletter welcome endpoint. When APPS_SCRIPT_URL is unset we still need the
  // webhook registered (it 401s all traffic without affecting the rest), so we
  // hand it a stub client whose .call() no-ops — the auth gate above runs first.
  const appsScript = config.APPS_SCRIPT_URL
    ? createAppsScriptClient({
        url: config.APPS_SCRIPT_URL,
        adminToken: config.APPS_SCRIPT_ADMIN_TOKEN,
        sheetId: config.SHEET_ID,
      })
    : {
        async call<T>(): Promise<T> {
          throw new Error('apps_script_not_configured');
        },
      };

  await app.register(webhooksRoute, {
    brevoSecret: process.env.BREVO_WEBHOOK_SECRET ?? '',
    appsScript,
  });

  if (config.APPS_SCRIPT_URL) {
    await app.register(publicRoute, { appsScript, rateLimit: { max: 5, windowMs: 10 * 60_000 } });
  }

  // Newsletter CRUD + send endpoints. Needs SHEET_ID (to read sheet tabs) +
  // APPS_SCRIPT_URL (save/schedule/delete all funnel through admin_* actions).
  if (config.SHEET_ID && config.APPS_SCRIPT_URL) {
    await app.register(newslettersRoute, {
      appsScript,
      requireAuth: (req) => {
        const u = (req as unknown as { user?: { email?: string } }).user;
        return u?.email ?? null;
      },
    });

    await app.register(writesContactRoute, {
      appsScript,
      requireAuth: (req) => {
        const u = (req as unknown as { user?: { email?: string } }).user;
        return u?.email ?? null;
      },
      invalidateCache: invalidateContactsCache,
    });

    await app.register(writesLessonRoute, {
      appsScript,
      requireAuth: (req) => {
        const u = (req as unknown as { user?: { email?: string } }).user;
        return u?.email ?? null;
      },
      invalidateCache: invalidateLessonsCache,
    });
  }

  // Newsletter welcome endpoint — invoked by Apps Script on first subscribe.
  // Auth is x-admin-token vs process.env.ADMIN_TOKEN (public from Apps Script
  // internal callers). Reads EmailTemplates directly via Sheets and sends via
  // Brevo, so we register whenever a SHEET_ID is configured.
  if (config.SHEET_ID) {
    await app.register(newsletterWelcomeRoute, { config });
  }

  // Contacts (CRM) read endpoints. Reads Subscribers/Customers/Tokens tabs via
  // Sheets — no Apps Script needed, so gate on SHEET_ID only.
  if (config.SHEET_ID) {
    await app.register(contactsRoute, {
      requireAuth: (req) => {
        const u = (req as unknown as { user?: { email?: string } }).user;
        return u?.email ?? null;
      },
    });

    await app.register(lessonsReadRoute, {
      requireAuth: (req) => {
        const u = (req as unknown as { user?: { email?: string } }).user;
        return u?.email ?? null;
      },
    });

    const activitySheets = await createSheetsClient(config);
    const adminSheetId = config.SHEET_ID_ADMIN ?? config.SHEET_ID!;
    await app.register(activityRoute, {
      readLog: () => readRecentActivity(activitySheets, adminSheetId),
      requireAuth: (req) => {
        const u = (req as unknown as { user?: { email?: string } }).user;
        return u?.email ?? null;
      },
    });

    await app.register(homeKpisRoute, {
      readTokens: () => readTokens(activitySheets, config.SHEET_ID!),
      requireAuth: (req) => {
        const u = (req as unknown as { user?: { email?: string } }).user;
        return u?.email ?? null;
      },
    });
  }

  // Cron tick for scheduled newsletter sends. Needs the same Sheets + Apps
  // Script plumbing as the newsletter routes, so gate on the same config and
  // skip under vitest to keep test runs deterministic.
  if (config.SHEET_ID && config.APPS_SCRIPT_URL && !process.env.VITEST) {
    startScheduler(appsScript);
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
