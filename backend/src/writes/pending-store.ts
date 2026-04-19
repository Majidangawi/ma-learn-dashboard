import { randomUUID } from 'node:crypto';

export type PendingStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'failed';

export interface PendingWrite {
  id: string;
  kind: string;
  inputs: unknown;
  preview: unknown;
  idempotencyKey: string;
  status: PendingStatus;
  createdAt: number;
  resolvedAt?: number;
  result?: unknown;
  error?: string;
}

interface Opts { ttlMs?: number; }

export class PendingWriteStore {
  private map = new Map<string, PendingWrite>();
  private ttlMs: number;
  constructor(opts: Opts = {}) { this.ttlMs = opts.ttlMs ?? 10 * 60_000; }

  stage(input: { kind: string; inputs: unknown; preview: unknown; idempotencyKey: string }): string {
    const id = randomUUID();
    this.map.set(id, { id, ...input, status: 'pending', createdAt: Date.now() });
    return id;
  }

  get(id: string): PendingWrite | undefined {
    const w = this.map.get(id);
    if (!w) return undefined;
    if (Date.now() - w.createdAt > this.ttlMs) { this.map.delete(id); return undefined; }
    return w;
  }

  approve(id: string): PendingWrite {
    const w = this.map.get(id);
    if (!w) throw new Error('not_found');
    if (w.status !== 'pending') throw new Error(`cannot_approve_${w.status}`);
    w.status = 'approved';
    w.resolvedAt = Date.now();
    return w;
  }
  reject(id: string): PendingWrite {
    const w = this.map.get(id);
    if (!w) throw new Error('not_found');
    if (w.status !== 'pending') throw new Error(`cannot_reject_${w.status}`);
    w.status = 'rejected';
    w.resolvedAt = Date.now();
    return w;
  }
  markExecuted(id: string, result: unknown): PendingWrite {
    const w = this.map.get(id);
    if (!w) throw new Error('not_found');
    w.status = 'executed';
    w.result = result;
    return w;
  }
  markFailed(id: string, error: string): PendingWrite {
    const w = this.map.get(id);
    if (!w) throw new Error('not_found');
    w.status = 'failed';
    w.error = error;
    return w;
  }
}
