import { describe, it, expect } from 'vitest';
import {
  previewToggleLesson, previewCreateCoupon, previewUpdateCoupon,
  previewSendEmail, previewLinkbioAdd, previewLinkbioUpdate,
} from '../../src/writes/previews.js';

describe('previewToggleLesson', () => {
  it('returns cell+from+to for known lesson', () => {
    const lessons = [
      { lessonId: 'L1', course: 't2', module: 'M3', moduleOrder: 0, title: 'Foo', active: false, order: 1 },
    ];
    expect(previewToggleLesson(lessons, 'L1', true)).toEqual({
      lessonId: 'L1', title: 'Foo', module: 'M3', from: false, to: true,
    });
  });
  it('throws for unknown lesson', () => {
    expect(() => previewToggleLesson([], 'X', true)).toThrow(/not_found/);
  });
});

describe('previewCreateCoupon', () => {
  it('echoes all fields uppercased + adds timestamp', () => {
    const p = previewCreateCoupon({
      code: 'earlybird', type: 'percentage', value: 20, minSAR: 0,
      usesLeft: 30, startDate: '', endDate: '2026-04-19', products: 't3',
    });
    expect(p.code).toBe('EARLYBIRD');
    expect(p.products).toBe('t3');
    expect(p.value).toBe(20);
  });
});

describe('previewUpdateCoupon', () => {
  it('returns only the fields being changed', () => {
    const existing = { code: 'X', type: 'percentage', value: 10, minSAR: 0, usesLeft: null, startDate: '', endDate: '', active: true, products: 'all', createdAt: '', createdBy: 'x' };
    const p = previewUpdateCoupon(existing, { value: 20, active: false });
    expect(p.changes).toEqual([{ field: 'value', from: 10, to: 20 }, { field: 'active', from: true, to: false }]);
  });
});

describe('previewSendEmail', () => {
  it('renders first 3 recipients with variables', () => {
    const tpl = { templateId: 'tpl1', name: 't', subjectAR: 'هلا {name}', subjectEN: 'Hi {name}',
      bodyAR: 'أهلاً {name}', bodyEN: 'Hello {name}', variables: ['name'], blocksAR: [], blocksEN: [] };
    const recips = [
      { email: 'a@x.com', name: 'Alice', product: 't3', amountSAR: 799, purchasedAt: '', token: 'T', source: 'real' },
      { email: 'b@x.com', name: 'Bob', product: 't3', amountSAR: 799, purchasedAt: '', token: 'T', source: 'real' },
      { email: 'c@x.com', name: 'Cara', product: 't3', amountSAR: 799, purchasedAt: '', token: 'T', source: 'real' },
      { email: 'd@x.com', name: 'Dan', product: 't3', amountSAR: 799, purchasedAt: '', token: 'T', source: 'real' },
    ];
    const p = previewSendEmail(tpl, recips, 'AR');
    expect(p.totalRecipients).toBe(4);
    expect(p.sample).toHaveLength(3);
    expect(p.sample[0].subject).toBe('هلا Alice');
    expect(p.sample[0].body).toBe('أهلاً Alice');
  });
  it('flags requiresExtraApproval when >500', () => {
    const tpl = { templateId: 'tpl1', name: 't', subjectAR: '', subjectEN: 'Hi', bodyAR: '', bodyEN: 'B', variables: [], blocksAR: [], blocksEN: [] };
    const recips = Array.from({ length: 501 }, (_, i) => ({ email: `u${i}@x.com`, name: `U${i}`, product: 't3', amountSAR: 1, purchasedAt: '', token: '', source: '' }));
    const p = previewSendEmail(tpl, recips, 'EN');
    expect(p.requiresExtraApproval).toBe(true);
  });
});

describe('previewLinkbioAdd', () => {
  it('returns fields with empty defaults', () => {
    expect(previewLinkbioAdd({ titleAR: 'أ', titleEN: 'A', url: 'https://x' })).toEqual({
      titleAR: 'أ', titleEN: 'A', url: 'https://x', icon: '', description: '',
    });
  });
});

describe('previewLinkbioUpdate', () => {
  it('diffs existing vs patch', () => {
    const existing = { linkId: 'LNK1', titleAR: 'أ', titleEN: 'A', url: 'https://x', icon: '', description: '', active: true, order: 1, clickCount: 0 };
    const p = previewLinkbioUpdate(existing, { active: false, order: 2 });
    expect(p.changes).toEqual([{ field: 'active', from: true, to: false }, { field: 'order', from: 1, to: 2 }]);
  });
});
