import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import type { Config } from '../config.js';
import { createAppsScriptClient } from '../apps-script/client.js';
import { createSheetsClient } from '../data/sheets-client.js';
import {
  readLessons, readCoupons, readEmailTemplates, readLinkbio,
} from '../data/read-extra.js';
import { readCustomers } from '../data/sheets-read.js';
import { resolveSegment } from '../data/segments.js';
import { appendAudit, isIdempotencyKeySeen } from '../data/audit-log.js';
import { PendingWriteStore } from '../writes/pending-store.js';
import {
  previewToggleLesson, previewCreateCoupon, previewUpdateCoupon,
  previewSendEmail, previewLinkbioAdd, previewLinkbioUpdate,
} from '../writes/previews.js';
import { brandWrapEmailBody } from '../writes/brand-wrap.js';
import { renderBlocks, type Block } from '../mail/blocks.js';

function idemKey(kind: string, inputs: unknown): string {
  return createHash('sha256').update(kind + JSON.stringify(inputs)).digest('hex').slice(0, 24);
}

export async function writesRoutes(app: FastifyInstance, config: Config): Promise<void> {
  if (!config.APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL missing');
  const script = createAppsScriptClient({
    url: config.APPS_SCRIPT_URL,
    adminToken: config.APPS_SCRIPT_ADMIN_TOKEN,
    sheetId: config.SHEET_ID,
  });
  const sheets = await createSheetsClient(config);
  const sid = config.SHEET_ID!;
  // Audit log lives on the dashboard-owned sheet, not the shared business sheet.
  const adminSid = config.SHEET_ID_ADMIN ?? sid;
  const store = new PendingWriteStore();

  async function audit(kind: string, inputs: unknown, output: unknown, approval: 'approved' | 'rejected', key: string): Promise<void> {
    await appendAudit(sheets, adminSid, {
      timestamp: new Date().toISOString(),
      actor: 'majid',
      tool: kind,
      inputs, output, approval,
      idempotencyKey: key,
    });
  }

  // ───── toggle_lesson ─────
  app.post('/api/writes/toggle_lesson', async (req, reply) => {
    const body = z.object({ lessonId: z.string(), active: z.boolean() }).parse(req.body);
    const lessons = await readLessons(sheets, sid);
    let preview;
    try { preview = previewToggleLesson(lessons, body.lessonId, body.active); }
    catch { return reply.code(404).send({ error: 'lesson_not_found' }); }
    const key = idemKey('toggle_lesson', body);
    if (await isIdempotencyKeySeen(sheets, sid, key)) return reply.code(409).send({ error: 'duplicate', key });
    const id = store.stage({ kind: 'toggle_lesson', inputs: body, preview, idempotencyKey: key });
    return { id, kind: 'toggle_lesson', preview, idempotencyKey: key };
  });

  // ───── create_coupon ─────
  app.post('/api/writes/create_coupon', async (req) => {
    const body = z.object({
      code: z.string(), type: z.enum(['percentage', 'flat']),
      value: z.number(), minSAR: z.number().optional(),
      usesLeft: z.number().nullable().optional(),
      startDate: z.string().optional(), endDate: z.string().optional(),
      products: z.string().optional(),
    }).parse(req.body);
    const preview = previewCreateCoupon(body, 'majid');
    const key = idemKey('create_coupon', preview);
    const id = store.stage({ kind: 'create_coupon', inputs: preview, preview, idempotencyKey: key });
    return { id, kind: 'create_coupon', preview, idempotencyKey: key };
  });

  // ───── update_coupon ─────
  app.post('/api/writes/update_coupon', async (req, reply) => {
    const body = z.object({ code: z.string(), patch: z.record(z.unknown()) }).parse(req.body);
    const coupons = await readCoupons(sheets, sid);
    const cur = coupons.find(c => c.code === body.code.toUpperCase());
    if (!cur) return reply.code(404).send({ error: 'coupon_not_found' });
    const preview = previewUpdateCoupon(cur, body.patch as Record<string, unknown>);
    const key = idemKey('update_coupon', body);
    const id = store.stage({ kind: 'update_coupon', inputs: body, preview, idempotencyKey: key });
    return { id, kind: 'update_coupon', preview, idempotencyKey: key };
  });

  // ───── add_email_template ─────
  app.post('/api/writes/add_email_template', async (req) => {
    const blockSchema = z.array(z.record(z.unknown())).optional();
    const body = z.object({
      name: z.string().min(1),
      templateId: z.string().optional(),
      subjectAR: z.string().default(''),
      subjectEN: z.string().default(''),
      rawBodyAR: z.string().default(''),
      rawBodyEN: z.string().default(''),
      blocksAR: blockSchema,
      blocksEN: blockSchema,
      variables: z.string().default('name'),
      // If true, rawBody* is already pre-wrapped HTML (used by older Noor drafts).
      alreadyWrapped: z.boolean().default(false),
    }).parse(req.body);

    const hasBlocks = (body.blocksAR && body.blocksAR.length > 0) || (body.blocksEN && body.blocksEN.length > 0);

    let bodyAR: string;
    let bodyEN: string;
    let blocksJson = '';

    if (hasBlocks) {
      bodyAR = body.blocksAR && body.blocksAR.length > 0
        ? renderBlocks(body.blocksAR as unknown as Block[], 'AR', {})
        : (body.rawBodyAR ? brandWrapEmailBody(body.rawBodyAR, 'AR') : '');
      bodyEN = body.blocksEN && body.blocksEN.length > 0
        ? renderBlocks(body.blocksEN as unknown as Block[], 'EN', {})
        : (body.rawBodyEN ? brandWrapEmailBody(body.rawBodyEN, 'EN') : '');
      blocksJson = JSON.stringify({ AR: body.blocksAR ?? [], EN: body.blocksEN ?? [] });
    } else {
      bodyAR = body.rawBodyAR
        ? (body.alreadyWrapped ? body.rawBodyAR : brandWrapEmailBody(body.rawBodyAR, 'AR'))
        : '';
      bodyEN = body.rawBodyEN
        ? (body.alreadyWrapped ? body.rawBodyEN : brandWrapEmailBody(body.rawBodyEN, 'EN'))
        : '';
    }

    const preview = {
      templateId: body.templateId ?? '(auto-generated)',
      name: body.name,
      subjectAR: body.subjectAR,
      subjectEN: body.subjectEN,
      bodyAR,
      bodyEN,
      variables: body.variables,
    };
    const key = idemKey('add_email_template', { name: body.name, subjectAR: body.subjectAR, subjectEN: body.subjectEN });
    const id = store.stage({
      kind: 'add_email_template',
      inputs: { ...body, bodyAR, bodyEN, blocksJson },
      preview,
      idempotencyKey: key,
    });
    return { id, kind: 'add_email_template', preview, idempotencyKey: key };
  });

  // ───── delete_coupon ─────
  app.post('/api/writes/delete_coupon', async (req, reply) => {
    const body = z.object({ code: z.string() }).parse(req.body);
    const coupons = await readCoupons(sheets, sid);
    const cur = coupons.find(c => c.code === body.code.toUpperCase());
    if (!cur) return reply.code(404).send({ error: 'coupon_not_found' });
    const preview = { code: cur.code, type: cur.type, value: cur.value, products: cur.products };
    const key = idemKey('delete_coupon', body);
    const id = store.stage({ kind: 'delete_coupon', inputs: body, preview, idempotencyKey: key });
    return { id, kind: 'delete_coupon', preview, idempotencyKey: key };
  });

  // ───── send_email ─────
  app.post('/api/writes/send_email', async (req, reply) => {
    const body = z.object({
      templateId: z.string(), segment: z.string(),
      language: z.enum(['AR', 'EN']),
      extraApproval: z.boolean().optional(),
    }).parse(req.body);
    const [templates, customers] = await Promise.all([
      readEmailTemplates(sheets, sid), readCustomers(sheets, sid),
    ]);
    const tpl = templates.find(t => t.templateId === body.templateId);
    if (!tpl) return reply.code(404).send({ error: 'template_not_found' });
    const recipients = resolveSegment(body.segment, customers);
    if (recipients.length === 0) return reply.code(400).send({ error: 'empty_segment' });
    const preview = previewSendEmail(tpl, recipients, body.language);
    if (preview.requiresExtraApproval && !body.extraApproval) {
      return reply.code(403).send({ error: 'requires_extra_approval', totalRecipients: preview.totalRecipients });
    }
    const key = idemKey('send_email', body);
    if (await isIdempotencyKeySeen(sheets, sid, key)) return reply.code(409).send({ error: 'duplicate', key });
    const id = store.stage({
      kind: 'send_email',
      inputs: {
        templateId: body.templateId, language: body.language,
        recipients: recipients.map(r => r.email),
        subjectTemplate: body.language === 'AR' ? tpl.subjectAR : tpl.subjectEN,
        bodyTemplate: body.language === 'AR' ? tpl.bodyAR : tpl.bodyEN,
      },
      preview,
      idempotencyKey: key,
    });
    return { id, kind: 'send_email', preview, idempotencyKey: key };
  });

  // ───── linkbio ─────
  app.post('/api/writes/linkbio_add', async (req) => {
    const body = z.object({ titleAR: z.string(), titleEN: z.string(), url: z.string().url(),
      icon: z.string().optional(), description: z.string().optional() }).parse(req.body);
    const preview = previewLinkbioAdd(body);
    const key = idemKey('linkbio_add', body);
    const id = store.stage({ kind: 'linkbio_add', inputs: body, preview, idempotencyKey: key });
    return { id, kind: 'linkbio_add', preview, idempotencyKey: key };
  });

  app.post('/api/writes/linkbio_update', async (req, reply) => {
    const body = z.object({ linkId: z.string(), patch: z.record(z.unknown()) }).parse(req.body);
    const items = await readLinkbio(sheets, sid);
    const cur = items.find(x => x.linkId === body.linkId);
    if (!cur) return reply.code(404).send({ error: 'link_not_found' });
    const preview = previewLinkbioUpdate(cur, body.patch as Record<string, unknown>);
    const key = idemKey('linkbio_update', body);
    const id = store.stage({ kind: 'linkbio_update', inputs: body, preview, idempotencyKey: key });
    return { id, kind: 'linkbio_update', preview, idempotencyKey: key };
  });

  app.post('/api/writes/linkbio_delete', async (req) => {
    const body = z.object({ linkId: z.string() }).parse(req.body);
    const preview = { linkId: body.linkId };
    const key = idemKey('linkbio_delete', body);
    const id = store.stage({ kind: 'linkbio_delete', inputs: body, preview, idempotencyKey: key });
    return { id, kind: 'linkbio_delete', preview, idempotencyKey: key };
  });

  app.post('/api/writes/linkbio_header', async (req) => {
    const body = z.object({
      photoURL: z.string().optional(),
      taglineAR: z.string().optional(),
      taglineEN: z.string().optional(),
    }).parse(req.body);
    const preview = body;
    const key = idemKey('linkbio_header', body);
    const id = store.stage({ kind: 'linkbio_header', inputs: body, preview, idempotencyKey: key });
    return { id, kind: 'linkbio_header', preview, idempotencyKey: key };
  });

  // ───── get / approve / reject ─────
  app.get('/api/writes/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const w = store.get(id);
    if (!w) return reply.code(404).send({ error: 'not_found' });
    return w;
  });

  app.post('/api/writes/:id/reject', async (req, reply) => {
    const { id } = req.params as { id: string };
    const w = store.get(id);
    if (!w) return reply.code(404).send({ error: 'not_found' });
    store.reject(id);
    await audit(w.kind, w.inputs, { rejected: true }, 'rejected', w.idempotencyKey);
    return { status: 'rejected' };
  });

  app.post('/api/writes/:id/approve', async (req, reply) => {
    const { id } = req.params as { id: string };
    const w = store.get(id);
    if (!w) return reply.code(404).send({ error: 'not_found' });
    store.approve(id);
    let result: unknown;
    try {
      result = await executeWrite(w.kind, w.inputs);
      store.markExecuted(id, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      store.markFailed(id, msg);
      await audit(w.kind, w.inputs, { error: msg }, 'approved', w.idempotencyKey);
      return reply.code(502).send({ status: 'failed', error: msg });
    }
    await audit(w.kind, w.inputs, result, 'approved', w.idempotencyKey);
    return { status: 'executed', result };
  });

  async function executeWrite(kind: string, inputs: unknown): Promise<unknown> {
    const i = inputs as Record<string, unknown>;
    switch (kind) {
      case 'toggle_lesson':
        return script.call('admin_toggle_lesson', { lesson_id: i.lessonId, active: i.active });
      case 'create_coupon':
        return script.call('admin_create_coupon', {
          code: i.code, type: i.type === 'percentage' ? 'percentage' : 'flat',
          value: i.value, min_sar: i.minSAR,
          uses_left: i.usesLeft ?? '',
          start_date: i.startDate, end_date: i.endDate,
          products: i.products, created_by: i.createdBy ?? 'majid',
        });
      case 'update_coupon': {
        const patch = (i.patch ?? {}) as Record<string, unknown>;
        return script.call('admin_update_coupon', { code: i.code, ...flattenCouponPatch(patch) });
      }
      case 'delete_coupon':
        return script.call('admin_delete_coupon', { code: i.code });
      case 'add_email_template':
        return script.call('admin_add_email_template', {
          template_id: i.templateId ?? '',
          name: i.name,
          subject_ar: i.subjectAR,
          subject_en: i.subjectEN,
          body_ar: i.bodyAR,
          body_en: i.bodyEN,
          variables: i.variables,
          blocks: i.blocksJson ?? '',
        });
      case 'send_email': {
        const customers = await readCustomers(sheets, sid);
        const byEmail = new Map(customers.map(c => [c.email.toLowerCase(), c]));
        const results: unknown[] = [];
        const subjectTpl = String(i.subjectTemplate ?? '');
        const bodyTpl = String(i.bodyTemplate ?? '');
        for (const email of (i.recipients as string[])) {
          const c = byEmail.get(email.toLowerCase());
          if (!c) continue;
          const vars: Record<string, string> = { name: c.name, token: c.token, product: c.product };
          const subject = subjectTpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
          const body = bodyTpl.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '');
          results.push(await script.call('admin_send_email', { to: email, subject, body }));
        }
        return { sent: results.length };
      }
      case 'linkbio_add':
        return script.call('admin_add_linkbio', {
          title_ar: i.titleAR, title_en: i.titleEN, url: i.url,
          icon: i.icon, description: i.description,
        });
      case 'linkbio_update': {
        const patch = (i.patch ?? {}) as Record<string, unknown>;
        return script.call('admin_update_linkbio', { link_id: i.linkId, ...flattenLinkbioPatch(patch) });
      }
      case 'linkbio_delete':
        return script.call('admin_delete_linkbio', { link_id: i.linkId });
      case 'linkbio_header':
        return script.call('admin_update_linkbio_header', {
          photo_url: i.photoURL, tagline_ar: i.taglineAR, tagline_en: i.taglineEN,
        });
    }
    throw new Error(`unknown_write_kind:${kind}`);
  }

  function flattenCouponPatch(p: Record<string, unknown>): Record<string, unknown> {
    const map: Record<string, string> = {
      value: 'value', minSAR: 'min_sar', usesLeft: 'uses_left',
      startDate: 'start_date', endDate: 'end_date', active: 'active', products: 'products',
    };
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) if (map[k]) out[map[k]] = v;
    return out;
  }
  function flattenLinkbioPatch(p: Record<string, unknown>): Record<string, unknown> {
    const map: Record<string, string> = {
      titleAR: 'title_ar', titleEN: 'title_en', url: 'url', icon: 'icon',
      description: 'description', active: 'active', order: 'order',
    };
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(p)) if (map[k]) out[map[k]] = v;
    return out;
  }
}
