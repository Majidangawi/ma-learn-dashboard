import { describe, it, expect, vi, beforeEach } from 'vitest';
import Fastify from 'fastify';
import contactsRoute from '../../src/routes/contacts.js';
import * as contactsData from '../../src/data/contacts.js';

const LIST_FIXTURE = [
  { email: 'a@x.com', name: 'Alice', language: 'AR', sources: ['buyer'],   status: 'active',       hasBought: true,  productsBought: ['creative-ai-workshop-t3'], addedAt: '2026-04-01T00:00:00', lastActivityAt: '2026-04-14T12:00:00' },
  { email: 'b@x.com', name: 'Bob',   language: 'EN', sources: ['website'], status: 'unsubscribed', hasBought: false, productsBought: [],                          addedAt: '2026-04-10T00:00:00', lastActivityAt: '2026-04-10T00:00:00' },
];

describe('contacts routes', () => {
  beforeEach(() => { vi.restoreAllMocks(); });

  async function setup() {
    vi.spyOn(contactsData, 'readContacts').mockResolvedValue(LIST_FIXTURE as any);
    vi.spyOn(contactsData, 'readContactDetail').mockImplementation(async (email) =>
      email === 'a@x.com'
        ? { ...LIST_FIXTURE[0], phone: '+966500000000', purchases: [], tokens: [] } as any
        : null
    );
    const app = Fastify();
    await app.register(contactsRoute, { requireAuth: () => 'majid' });
    return app;
  }

  it('GET /api/data/contacts returns list', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/data/contacts' });
    expect(res.statusCode).toBe(200);
    expect(res.json().contacts).toHaveLength(2);
  });

  it('GET /api/data/contacts filters by status=unsubscribed', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/data/contacts?status=unsubscribed' });
    expect(res.json().contacts).toHaveLength(1);
    expect(res.json().contacts[0].email).toBe('b@x.com');
  });

  it('GET /api/data/contacts filters by sources', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/data/contacts?sources=website' });
    expect(res.json().contacts).toHaveLength(1);
    expect(res.json().contacts[0].email).toBe('b@x.com');
  });

  it('GET /api/data/contacts filters by products', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/data/contacts?products=creative-ai-workshop-t3' });
    expect(res.json().contacts).toHaveLength(1);
    expect(res.json().contacts[0].email).toBe('a@x.com');
  });

  it('GET /api/data/contacts search by q matches name or email case-insensitive', async () => {
    const app = await setup();
    expect((await app.inject({ method: 'GET', url: '/api/data/contacts?q=ALICE' })).json().contacts).toHaveLength(1);
    expect((await app.inject({ method: 'GET', url: '/api/data/contacts?q=b@x' })).json().contacts).toHaveLength(1);
  });

  it('GET /api/data/contacts?sort=name sorts alphabetically', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/data/contacts?sort=name' });
    const emails = res.json().contacts.map((c: any) => c.email);
    expect(emails).toEqual(['a@x.com', 'b@x.com']);
  });

  it('GET /api/data/contacts/:email returns detail', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/data/contacts/a@x.com' });
    expect(res.statusCode).toBe(200);
    expect(res.json().contact.email).toBe('a@x.com');
  });

  it('GET /api/data/contacts/:email returns 404 for unknown', async () => {
    const app = await setup();
    const res = await app.inject({ method: 'GET', url: '/api/data/contacts/nope@x.com' });
    expect(res.statusCode).toBe(404);
  });

  it('401 without auth', async () => {
    vi.spyOn(contactsData, 'readContacts').mockResolvedValue(LIST_FIXTURE as any);
    const app = Fastify();
    await app.register(contactsRoute, { requireAuth: () => null });
    const res = await app.inject({ method: 'GET', url: '/api/data/contacts' });
    expect(res.statusCode).toBe(401);
  });
});
