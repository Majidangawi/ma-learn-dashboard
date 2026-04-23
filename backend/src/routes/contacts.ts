import { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { readContacts, readContactDetail, type ContactListRow } from '../data/contacts.js';

interface Opts {
  requireAuth: (req: FastifyRequest) => string | null;
}

type SortKey = 'activity' | 'added' | 'name';

function applyListFilters(rows: ContactListRow[], q: URLSearchParams): ContactListRow[] {
  const status = q.get('status') || 'all';
  const sources = (q.get('sources') || '').split(',').map(s => s.trim()).filter(Boolean);
  const products = (q.get('products') || '').split(',').map(s => s.trim()).filter(Boolean);
  const language = q.get('language') || 'all';
  const search = (q.get('q') || '').toLowerCase().trim();

  return rows.filter(r => {
    if (status !== 'all' && r.status !== status) return false;
    if (language !== 'all' && r.language !== language) return false;
    if (sources.length > 0 && !sources.some(s => r.sources.includes(s))) return false;
    if (products.length > 0) {
      const wantsNonBuyer = products.includes('__nonbuyer');
      const matchesProduct = products.some(p => r.productsBought.includes(p));
      if (wantsNonBuyer && r.hasBought) return false;
      if (!wantsNonBuyer && !matchesProduct) return false;
    }
    if (search) {
      const hay = `${r.name} ${r.email}`.toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function sortRows(rows: ContactListRow[], sort: SortKey): ContactListRow[] {
  const copy = [...rows];
  if (sort === 'name')     return copy.sort((a, b) => a.name.localeCompare(b.name) || a.email.localeCompare(b.email));
  if (sort === 'added')    return copy.sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
  return copy.sort((a, b) => (b.lastActivityAt || '').localeCompare(a.lastActivityAt || ''));
}

const plugin: FastifyPluginAsync<Opts> = async (app, opts) => {
  app.get('/api/data/contacts', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const url = new URL(req.url, 'http://local');
    const rows = await readContacts();
    const filtered = applyListFilters(rows, url.searchParams);
    const sort = (url.searchParams.get('sort') || 'activity') as SortKey;
    const sorted = sortRows(filtered, sort);
    return { contacts: sorted };
  });

  app.get('/api/data/contacts/:email', async (req, reply) => {
    if (!opts.requireAuth(req)) return reply.code(401).send({ error: 'unauthorized' });
    const email = decodeURIComponent((req.params as { email: string }).email);
    const detail = await readContactDetail(email);
    if (!detail) return reply.code(404).send({ error: 'not_found' });
    return { contact: detail };
  });
};

export default plugin;
