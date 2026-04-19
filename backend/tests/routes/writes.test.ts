import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { hashPassword } from '../../src/auth/password.js';
import { issueSession } from '../../src/auth/session.js';

const scriptCalls: { action: string; params: Record<string, string> }[] = [];

vi.mock('../../src/apps-script/client.js', () => ({
  createAppsScriptClient: () => ({
    async call(action: string, params: Record<string, unknown>) {
      scriptCalls.push({ action, params: params as Record<string, string> });
      return { ok: true };
    },
  }),
}));

vi.mock('../../src/data/sheets-client.js', () => ({
  createSheetsClient: vi.fn(async () => ({
    spreadsheets: { values: {
      get: vi.fn(async ({ range }: { range: string }) => {
        if (range === 'Lessons') return { data: { values: [
          ['LessonID','Course','Module','Title','Active','Order'],
          ['L1','t2','M3','Foo','FALSE','1'],
        ] } };
        if (range === 'AuditLog!G:G') return { data: { values: [] } };
        return { data: { values: [] } };
      }),
      append: vi.fn(async () => ({ data: {} })),
      update: vi.fn(async () => ({ data: {} })),
    } },
  })),
}));

let app: any;
let sessionCookie: string;

beforeAll(async () => {
  process.env.NODE_ENV = 'staging';
  process.env.ALLOWED_ADMIN_EMAIL = 'majed.engawi@gmail.com';
  process.env.JWT_SECRET = 'a'.repeat(64);
  process.env.GOOGLE_OAUTH_CLIENT_ID = 't';
  process.env.GOOGLE_OAUTH_CLIENT_SECRET = 't';
  process.env.BACKEND_OAUTH_CLIENT_ID = 't';
  process.env.BACKEND_OAUTH_CLIENT_SECRET = 't';
  process.env.BACKEND_OAUTH_REFRESH_TOKEN = 't';
  process.env.GMAIL_SENDER = 'majid@malearnsa.com';
  process.env.APPS_SCRIPT_URL = 'https://script.example.com/exec';
  process.env.APPS_SCRIPT_ADMIN_TOKEN = 'TKN';
  process.env.SHEET_ID = 'sid';
  process.env.PASSWORD_HASH = await hashPassword('pw12345678');
  const { buildServer } = await import('../../src/server.js');
  app = await buildServer();
  sessionCookie = `session=${await issueSession('a'.repeat(64), { email: 'majed.engawi@gmail.com' })}`;
});
afterAll(async () => { await app.close(); });

describe('POST /api/writes/toggle_lesson', () => {
  it('stages + approve executes + reject skips execution', async () => {
    scriptCalls.length = 0;

    const stage = await app.inject({
      method: 'POST', url: '/api/writes/toggle_lesson',
      headers: { cookie: sessionCookie, 'content-type': 'application/json' },
      payload: { lessonId: 'L1', active: true },
    });
    expect(stage.statusCode).toBe(200);
    const { id, preview } = stage.json();
    expect(preview.from).toBe(false);
    expect(preview.to).toBe(true);

    const approve = await app.inject({
      method: 'POST', url: `/api/writes/${id}/approve`,
      headers: { cookie: sessionCookie, 'content-type': 'application/json' },
      payload: {},
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().status).toBe('executed');
    expect(scriptCalls.some(c => c.action === 'admin_toggle_lesson' && c.params.lesson_id === 'L1')).toBe(true);
  });

  it('reject returns rejected and does not call Apps Script', async () => {
    scriptCalls.length = 0;
    const stage = await app.inject({
      method: 'POST', url: '/api/writes/toggle_lesson',
      headers: { cookie: sessionCookie, 'content-type': 'application/json' },
      payload: { lessonId: 'L1', active: false },
    });
    const { id } = stage.json();
    const reject = await app.inject({
      method: 'POST', url: `/api/writes/${id}/reject`,
      headers: { cookie: sessionCookie, 'content-type': 'application/json' },
      payload: {},
    });
    expect(reject.json().status).toBe('rejected');
    expect(scriptCalls.some(c => c.action === 'admin_toggle_lesson')).toBe(false);
  });

  it('404 for unknown lesson', async () => {
    const r = await app.inject({
      method: 'POST', url: '/api/writes/toggle_lesson',
      headers: { cookie: sessionCookie, 'content-type': 'application/json' },
      payload: { lessonId: 'NONE', active: true },
    });
    expect(r.statusCode).toBe(404);
  });

  it('rejects unauthenticated', async () => {
    const r = await app.inject({
      method: 'POST', url: '/api/writes/toggle_lesson',
      headers: { 'content-type': 'application/json' },
      payload: { lessonId: 'L1', active: true },
    });
    expect(r.statusCode).toBe(401);
  });
});
