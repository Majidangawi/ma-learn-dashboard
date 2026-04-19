import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { hashPassword } from '../../src/auth/password.js';
import { issueSession } from '../../src/auth/session.js';

vi.mock('../../src/data/sheets-client.js', () => ({
  createSheetsClient: vi.fn(async () => ({
    spreadsheets: {
      values: {
        get: vi.fn(async ({ range }: { range: string }) => {
          if (range === 'Customers') return { data: { values: [
            ['Email','Name','Product','AmountSAR','PurchasedAt','Token','Source'],
            ['a@x.com','A','t3','799','2026-04-18T10:00:00','MAL-1','real'],
          ] } };
          if (range === 'Lessons') return { data: { values: [
            ['LessonID','Course','Module','Title','Active','Order'],
            ['L1','t2','M1','Intro','TRUE','1'],
          ] } };
          if (range === 'Coupons') return { data: { values: [
            ['Code','Type','Value','Min Amount (SAR)','Uses Left','Start Date','End Date','Active'],
            ['EARLY','percentage','20','0','','','','TRUE'],
          ] } };
          if (range === 'Tokens') return { data: { values: [['Token','Product','Email','Status','AssignedAt']] } };
          if (range === 'LinkInBio') return { data: { values: [['LinkID','TitleAR','TitleEN','URL','Icon','Description','Active','Order','ClickCount']] } };
          if (range === 'LinkInBioHeader') return { data: { values: [['Key','Value']] } };
          if (range === 'EmailTemplates') return { data: { values: [['TemplateID','Name','SubjectAR','SubjectEN','BodyAR','BodyEN','Variables']] } };
          return { data: { values: [] } };
        }),
      },
    },
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
  process.env.APPS_SCRIPT_ADMIN_TOKEN = 'TKN';
  process.env.SHEET_ID = 'sid';
  process.env.PASSWORD_HASH = await hashPassword('pw12345678');
  const { buildServer } = await import('../../src/server.js');
  app = await buildServer();
  sessionCookie = `session=${await issueSession('a'.repeat(64), { email: 'majed.engawi@gmail.com' })}`;
});
afterAll(async () => { await app.close(); });

describe('/api/data/*', () => {
  it('GET /api/data/customers returns parsed list', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/data/customers', headers: { cookie: sessionCookie } });
    expect(r.statusCode).toBe(200);
    expect(r.json().customers[0].email).toBe('a@x.com');
  });
  it('GET /api/data/lessons returns lessons', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/data/lessons', headers: { cookie: sessionCookie } });
    expect(r.statusCode).toBe(200);
    expect(r.json().lessons[0].lessonId).toBe('L1');
  });
  it('GET /api/insights returns computed insights', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/insights', headers: { cookie: sessionCookie } });
    expect(r.statusCode).toBe(200);
    const body = r.json();
    expect(body.revenue30Days).toHaveLength(30);
    expect(body.t3SeatsTotal).toBe(30);
  });
  it('rejects unauthenticated access', async () => {
    const r = await app.inject({ method: 'GET', url: '/api/data/customers' });
    expect(r.statusCode).toBe(401);
  });
});
