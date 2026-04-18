import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Config } from '../config.js';
import { createNoorClient } from '../noor/client.js';
import { InMemoryCostTracker } from '../noor/cost-cap.js';
import {
  createPlan, approvePlan, rejectPlan, markExecuted, type Plan,
} from '../noor/state-machine.js';
import { isWriteTool } from '../noor/tools.js';

const planStore = new Map<string, Plan>();

export async function noorRoutes(app: FastifyInstance, config: Config): Promise<void> {
  const tracker = new InMemoryCostTracker(config.NOOR_MONTHLY_CAP_USD);

  // Lazy-init the Noor client so tests without ANTHROPIC_API_KEY don't crash.
  let noorClient: ReturnType<typeof createNoorClient> | null = null;
  function getClient() {
    if (!noorClient) noorClient = createNoorClient(config, tracker);
    return noorClient;
  }

  app.post('/api/noor/plan', async (req, reply) => {
    const { prompt } = z.object({ prompt: z.string().min(1) }).parse(req.body);
    try {
      const { toolCalls, text } = await getClient().plan(prompt);
      const plan = createPlan({
        prompt,
        toolCalls: toolCalls.map((c) => ({ name: c.name, input: c.input })),
      });
      planStore.set(plan.id, plan);
      return {
        planId: plan.id,
        text,
        toolCalls: plan.toolCalls,
        requiresApproval: plan.toolCalls.some((c) => isWriteTool(c.name)),
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
      planId: z.string(),
      decision: z.enum(['approve', 'reject']),
    }).parse(req.body);
    const p = planStore.get(planId);
    if (!p) return reply.code(404).send({ error: 'plan_not_found' });
    if (decision === 'reject') {
      planStore.set(p.id, rejectPlan(p));
      return { status: 'rejected' };
    }
    const approved = approvePlan(p);
    planStore.set(p.id, approved);
    // Plan 1 note: actual tool dispatch happens in Plan 2 per-feature. For now
    // we mark the plan executed with a placeholder result so the UI round-trip works.
    planStore.set(p.id, markExecuted(approved, { note: 'execution-wired-in-plan-2' }));
    return { status: 'executed', result: { note: 'execution-wired-in-plan-2' } };
  });

  app.get('/api/noor/cost', async () => ({
    monthToDateUSD: tracker.monthToDateUSD(),
    capUSD: config.NOOR_MONTHLY_CAP_USD,
    overCap: tracker.isOverCap(),
  }));
}
