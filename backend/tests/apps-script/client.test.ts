import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAppsScriptClient } from '../../src/apps-script/client.js';

describe('AppsScriptClient', () => {
  const originalFetch = globalThis.fetch;
  let calls: { url: string; method: string }[] = [];

  beforeEach(() => {
    calls = [];
    globalThis.fetch = vi.fn(async (url: any, init: any) => {
      calls.push({ url: String(url), method: String(init?.method ?? 'GET') });
      return new Response(JSON.stringify({ ok: true, echoed: true }), { status: 200 });
    }) as any;
  });
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('GETs URL with action + admin_token in query params', async () => {
    const c = createAppsScriptClient({ url: 'https://script.test/exec', adminToken: 'TKN' });
    const res = await c.call('admin_toggle_lesson', { lesson_id: 'L3', active: true });
    expect(res).toEqual({ ok: true, echoed: true });
    expect(calls.length).toBe(1);
    expect(calls[0].method).toBe('GET');
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe('https://script.test/exec');
    expect(url.searchParams.get('action')).toBe('admin_toggle_lesson');
    expect(url.searchParams.get('admin_token')).toBe('TKN');
    expect(url.searchParams.get('lesson_id')).toBe('L3');
    expect(url.searchParams.get('active')).toBe('true');
  });

  it('throws when Apps Script returns ok: false', async () => {
    globalThis.fetch = vi.fn(async () =>
      new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 200 }),
    ) as any;
    const c = createAppsScriptClient({ url: 'https://script.test/exec', adminToken: 'WRONG' });
    await expect(c.call('admin_toggle_lesson', {})).rejects.toThrow(/unauthorized/);
  });

  it('throws when HTTP non-2xx', async () => {
    globalThis.fetch = vi.fn(async () => new Response('bad', { status: 502 })) as any;
    const c = createAppsScriptClient({ url: 'https://script.test/exec', adminToken: 'T' });
    await expect(c.call('admin_toggle_lesson', {})).rejects.toThrow(/502/);
  });
});
