import type { FastifyInstance } from 'fastify';
import type { Config } from '../config.js';
import { createSheetsClient } from '../data/sheets-client.js';
import { readCustomers } from '../data/sheets-read.js';
import {
  readLessons, readTokens, readCoupons,
  readLinkbio, readLinkbioHeader, readEmailTemplates,
} from '../data/read-extra.js';
import { computeInsights } from '../data/insights.js';

export async function dataRoutes(app: FastifyInstance, config: Config): Promise<void> {
  if (!config.SHEET_ID) throw new Error('SHEET_ID missing');
  const sid = config.SHEET_ID;
  const sheets = await createSheetsClient(config);

  app.get('/api/data/customers', async () => ({ customers: await readCustomers(sheets, sid) }));
  app.get('/api/data/lessons', async (req) => {
    const course = (req.query as { course?: string } | undefined)?.course;
    const lessons = await readLessons(sheets, sid);
    return { lessons: course ? lessons.filter((l: { course?: string }) => l.course === course) : lessons };
  });
  app.get('/api/data/tokens', async () => ({ tokens: await readTokens(sheets, sid) }));
  app.get('/api/data/coupons', async () => ({ coupons: await readCoupons(sheets, sid) }));
  app.get('/api/data/linkbio', async () => {
    const [items, header] = await Promise.all([
      readLinkbio(sheets, sid),
      readLinkbioHeader(sheets, sid),
    ]);
    return { items, header };
  });
  app.get('/api/data/templates', async () => ({ templates: await readEmailTemplates(sheets, sid) }));

  app.get('/api/insights', async () => {
    const [customers, tokens] = await Promise.all([
      readCustomers(sheets, sid),
      readTokens(sheets, sid),
    ]);
    return computeInsights({ customers, tokens, now: new Date() });
  });

  // Public (no auth) endpoint — served to link.malearnsa.com visitors.
  app.get('/api/public/linkbio', async () => {
    const [items, header] = await Promise.all([
      readLinkbio(sheets, sid),
      readLinkbioHeader(sheets, sid),
    ]);
    return { items: items.filter(x => x.active), header };
  });
}
