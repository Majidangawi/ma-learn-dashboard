import { describe, it, expect } from 'vitest';
import {
  parseLessons, parseTokens, parseCoupons,
  parseLinkbio, parseLinkbioHeader, parseEmailTemplates,
} from '../../src/data/read-extra.js';

describe('parseLessons', () => {
  it('maps rows to typed lessons', () => {
    const rows = [
      ['LessonID', 'Course', 'Module', 'Title', 'Active', 'Order'],
      ['L1', 't2', 'M1', 'Intro', 'TRUE', '1'],
      ['L2', 't2', 'M3', 'Prompts', 'FALSE', '2'],
    ];
    expect(parseLessons(rows)).toEqual([
      { lessonId: 'L1', course: 't2', module: 'M1', title: 'Intro', active: true, order: 1 },
      { lessonId: 'L2', course: 't2', module: 'M3', title: 'Prompts', active: false, order: 2 },
    ]);
  });
  it('returns [] when only header', () => { expect(parseLessons([['LessonID']])).toEqual([]); });
});

describe('parseTokens', () => {
  it('maps rows', () => {
    const rows = [
      ['Token', 'Product', 'Email', 'Status', 'AssignedAt'],
      ['MAL-AB12CD34', 't3', 'a@b.com', 'used', '2026-04-15T10:00:00'],
    ];
    expect(parseTokens(rows)).toEqual([
      { token: 'MAL-AB12CD34', product: 't3', email: 'a@b.com', status: 'used', assignedAt: '2026-04-15T10:00:00' },
    ]);
  });
});

describe('parseCoupons', () => {
  it('handles extended schema with Products/CreatedAt/CreatedBy', () => {
    const rows = [
      ['Code', 'Type', 'Value', 'Min Amount (SAR)', 'Uses Left', 'Start Date', 'End Date', 'Active', 'Products', 'CreatedAt', 'CreatedBy'],
      ['EARLY', 'percentage', '20', '0', '25', '', '2026-04-19', 'TRUE', 't3', '2026-04-01T00:00:00', 'majid'],
    ];
    expect(parseCoupons(rows)).toEqual([
      {
        code: 'EARLY', type: 'percentage', value: 20, minSAR: 0,
        usesLeft: 25, startDate: '', endDate: '2026-04-19', active: true,
        products: 't3', createdAt: '2026-04-01T00:00:00', createdBy: 'majid',
      },
    ]);
  });
  it('tolerates legacy rows missing extension columns', () => {
    const rows = [
      ['Code', 'Type', 'Value', 'Min Amount (SAR)', 'Uses Left', 'Start Date', 'End Date', 'Active'],
      ['LEGACY', 'percentage', '10', '0', '', '', '', 'TRUE'],
    ];
    const r = parseCoupons(rows);
    expect(r[0].code).toBe('LEGACY');
    expect(r[0].products).toBe('all');
    expect(r[0].usesLeft).toBeNull();
  });
});

describe('parseLinkbio', () => {
  it('maps rows ordered by Order asc', () => {
    const rows = [
      ['LinkID','TitleAR','TitleEN','URL','Icon','Description','Active','Order','ClickCount'],
      ['LNK-B','عربي ب','En B','https://b','📷','','TRUE','2','5'],
      ['LNK-A','عربي أ','En A','https://a','🎓','','TRUE','1','3'],
    ];
    const r = parseLinkbio(rows);
    expect(r.map(x => x.linkId)).toEqual(['LNK-A', 'LNK-B']);
    expect(r[0].clickCount).toBe(3);
  });
});

describe('parseLinkbioHeader', () => {
  it('maps key-value rows', () => {
    const rows = [
      ['Key','Value'],
      ['PhotoURL','https://img'],
      ['TaglineAR','صناعة الإلهام'],
      ['TaglineEN','Making Inspiration'],
    ];
    expect(parseLinkbioHeader(rows)).toEqual({
      photoURL: 'https://img',
      taglineAR: 'صناعة الإلهام',
      taglineEN: 'Making Inspiration',
    });
  });
});

describe('parseEmailTemplates', () => {
  it('splits Variables csv', () => {
    const rows = [
      ['TemplateID','Name','SubjectAR','SubjectEN','BodyAR','BodyEN','Variables'],
      ['t3-m3','T3 M3 unlock','مفتوح!','Unlocked!','هلا {name}','Hi {name}','name,playerURL'],
    ];
    const r = parseEmailTemplates(rows);
    expect(r[0].variables).toEqual(['name', 'playerURL']);
  });
});
