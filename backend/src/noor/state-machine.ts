import { randomUUID } from 'node:crypto';

export type PlanStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

export interface Plan {
  id: string;
  prompt: string;
  toolCalls: { name: string; input: unknown }[];
  status: PlanStatus;
  createdAt: string;
  resolvedAt?: string;
  result?: unknown;
}

export function createPlan(input: { prompt: string; toolCalls: Plan['toolCalls'] }): Plan {
  return {
    id: randomUUID(),
    prompt: input.prompt,
    toolCalls: input.toolCalls,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
}

export function approvePlan(p: Plan): Plan {
  if (p.status !== 'pending') throw new Error(`cannot approve plan in status ${p.status}`);
  return { ...p, status: 'approved', resolvedAt: new Date().toISOString() };
}

export function rejectPlan(p: Plan): Plan {
  if (p.status !== 'pending') throw new Error(`cannot reject plan in status ${p.status}`);
  return { ...p, status: 'rejected', resolvedAt: new Date().toISOString() };
}

export function markExecuted(p: Plan, result: unknown): Plan {
  if (p.status !== 'approved') throw new Error(`cannot execute plan in status ${p.status}`);
  return { ...p, status: 'executed', result, resolvedAt: new Date().toISOString() };
}
