import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Config } from '../config.js';
import { createNoorClient } from '../noor/client.js';
import { InMemoryCostTracker } from '../noor/cost-cap.js';
import {
  createPlan, approvePlan, rejectPlan, markExecuted, type Plan,
} from '../noor/state-machine.js';
import { isWriteTool, toolRegistry } from '../noor/tools.js';
import { dispatchToolCalls, type Dispatcher } from '../noor/dispatcher.js';
import { createAppsScriptClient } from '../apps-script/client.js';
import { createSheetsClient } from '../data/sheets-client.js';
import { readCustomers } from '../data/sheets-read.js';
import {
  readLessons, readTokens, readCoupons, readLinkbio,
} from '../data/read-extra.js';
import { computeInsights } from '../data/insights.js';

const planStore = new Map<string, Plan>();

export async function noorRoutes(app: FastifyInstance, config: Config): Promise<void> {
  const tracker = new InMemoryCostTracker(config.NOOR_MONTHLY_CAP_USD);
  let noorClient: ReturnType<typeof createNoorClient> | null = null;
  function getClient() {
    if (!noorClient) noorClient = createNoorClient(config, tracker);
    return noorClient;
  }

  // Lazy-init data/script clients so buildServer succeeds when SHEET_ID/APPS_SCRIPT_URL absent.
  let _sheets: Awaited<ReturnType<typeof createSheetsClient>> | null = null;
  async function sheetsClient() {
    if (!_sheets) _sheets = await createSheetsClient(config);
    return _sheets;
  }
  let _script: ReturnType<typeof createAppsScriptClient> | null = null;
  function scriptClient() {
    if (!_script) {
      if (!config.APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL missing');
      _script = createAppsScriptClient({ url: config.APPS_SCRIPT_URL, adminToken: config.APPS_SCRIPT_ADMIN_TOKEN });
    }
    return _script;
  }

  const dispatcher: Dispatcher = {
    async readTool(name) {
      const sheets = await sheetsClient();
      const sid = config.SHEET_ID!;
      switch (name) {
        case 'read_customers': return { customers: await readCustomers(sheets, sid) };
        case 'read_lessons': return { lessons: await readLessons(sheets, sid) };
        case 'read_tokens': return { tokens: await readTokens(sheets, sid) };
        case 'read_coupons': return { coupons: await readCoupons(sheets, sid) };
        case 'read_linkbio': return { items: await readLinkbio(sheets, sid) };
        case 'read_insights': {
          const [customers, tokens] = await Promise.all([readCustomers(sheets, sid), readTokens(sheets, sid)]);
          return computeInsights({ customers, tokens, now: new Date(), anthropicSpendUSD: tracker.monthToDateUSD() });
        }
      }
      throw new Error(`unknown_read:${name}`);
    },
    async writeTool(name, input) {
      const s = scriptClient();
      const i = (input ?? {}) as Record<string, unknown>;
      switch (name) {
        case 'toggle_lesson': return s.call('admin_toggle_lesson', { lesson_id: i.lessonId, active: i.active });
        case 'create_coupon': return s.call('admin_create_coupon', {
          code: i.code, type: i.type, value: i.value,
          uses_left: i.usageCap ?? '', start_date: '', end_date: i.expires ?? '',
          products: Array.isArray(i.products) ? (i.products as string[]).join(',') : (i.products ?? 'all'),
          created_by: 'noor',
        });
        case 'update_coupon': return s.call('admin_update_coupon', { code: i.code, ...(i as object) });
        case 'add_linkbio_link': return s.call('admin_add_linkbio', { title_ar: i.titleAR, title_en: i.titleEN, url: i.url });
        case 'update_linkbio_link': return s.call('admin_update_linkbio', { link_id: i.linkId, ...(i as object) });
        case 'delete_linkbio_link': return s.call('admin_delete_linkbio', { link_id: i.linkId });
      }
      throw new Error(`unknown_write:${name}`);
    },
    async reasonTool(name, input) {
      switch (name) {
        case 'get_current_time': return { nowKSA: new Date().toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' }) };
        case 'log_action': return { logged: true, note: (input as { note?: string })?.note ?? '' };
      }
      throw new Error(`unknown_reason:${name}`);
    },
  };

  app.post('/api/noor/plan', async (req, reply) => {
    const { prompt } = z.object({ prompt: z.string().min(1) }).parse(req.body);
    try {
      const { toolCalls, text } = await getClient().plan(prompt);
      const plan = createPlan({
        prompt,
        toolCalls: toolCalls.map((c) => ({ name: c.name, input: c.input })),
      });
      const readOrReason = plan.toolCalls.filter(c => {
        const t = toolRegistry.find(x => x.name === c.name);
        return t && (t.mode === 'read' || t.mode === 'reason');
      });
      const writeCalls = plan.toolCalls.filter(c => isWriteTool(c.name));
      const autoResults = await dispatchToolCalls(readOrReason, dispatcher);
      planStore.set(plan.id, plan);
      return {
        planId: plan.id,
        text,
        autoResults,
        pendingWrites: writeCalls,
        requiresApproval: writeCalls.length > 0,
        monthToDateUSD: tracker.monthToDateUSD(),
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg === 'noor_cost_cap_reached') return reply.code(429).send({ error: 'cost_cap_reached' });
      throw e;
    }
  });

  app.post('/api/noor/resolve', async (req, reply) => {
    const { planId, decision } = z.object({
      planId: z.string(), decision: z.enum(['approve', 'reject']),
    }).parse(req.body);
    const p = planStore.get(planId);
    if (!p) return reply.code(404).send({ error: 'plan_not_found' });
    if (decision === 'reject') {
      planStore.set(p.id, rejectPlan(p));
      return { status: 'rejected' };
    }
    const approved = approvePlan(p);
    planStore.set(p.id, approved);
    try {
      const writes = approved.toolCalls.filter(c => isWriteTool(c.name));
      const results = await dispatchToolCalls(writes, dispatcher, { approveAll: true });
      planStore.set(p.id, markExecuted(approved, results));
      return { status: 'executed', results };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.code(502).send({ status: 'failed', error: msg });
    }
  });

  app.get('/api/noor/cost', async () => ({
    monthToDateUSD: tracker.monthToDateUSD(),
    capUSD: config.NOOR_MONTHLY_CAP_USD,
    overCap: tracker.isOverCap(),
  }));
}
