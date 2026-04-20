import type { SheetsClient } from './sheets-client.js';
import type { Block } from '../mail/blocks.js';
import { markdownToBlocks } from '../mail/migrate-markdown.js';

export interface Lesson { lessonId: string; course: string; module: string; moduleOrder: number; title: string; active: boolean; order: number; }
export interface Token { token: string; product: string; email: string; status: string; assignedAt: string; }
export interface Coupon {
  code: string; type: string; value: number; minSAR: number;
  usesLeft: number | null; startDate: string; endDate: string; active: boolean;
  products: string; createdAt: string; createdBy: string;
}
export interface LinkbioItem {
  linkId: string; titleAR: string; titleEN: string; url: string;
  icon: string; description: string; active: boolean; order: number; clickCount: number;
}
export interface LinkbioHeader {
  photoURL: string;
  taglineAR: string;
  taglineEN: string;
  nameAR: string;
  subtitleAR: string;
  bioAR: string;
}
export interface EmailTemplate {
  templateId: string; name: string; subjectAR: string; subjectEN: string;
  bodyAR: string; bodyEN: string; variables: string[];
  blocksAR: Block[]; blocksEN: Block[];
}

function idx(header: string[] | undefined, name: string): number {
  return header ? header.indexOf(name) : -1;
}
function trueish(v: unknown): boolean {
  return String(v ?? '').trim().toUpperCase() === 'TRUE';
}
function numOrNull(v: unknown): number | null {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function parseLessons(rows: string[][] | undefined): Lesson[] {
  if (!rows || rows.length < 2) return [];
  const [h, ...d] = rows;
  // Accept both dashboard-native ('LessonID', 'Order') and existing sheet ('ID', 'Lesson Order') names.
  const iId = idx(h, 'LessonID') >= 0 ? idx(h, 'LessonID') : idx(h, 'ID');
  const iCourse = idx(h, 'Course'), iModule = idx(h, 'Module');
  const iModuleOrder = idx(h, 'Module Order');
  const iTitle = idx(h, 'Title'), iActive = idx(h, 'Active');
  const iOrder = idx(h, 'Order') >= 0 ? idx(h, 'Order') : idx(h, 'Lesson Order');
  return d.filter(r => r[iId]).map(r => ({
    lessonId: r[iId] ?? '', course: r[iCourse] ?? '', module: r[iModule] ?? '',
    moduleOrder: iModuleOrder >= 0 ? Number(r[iModuleOrder] ?? 0) : 0,
    title: r[iTitle] ?? '', active: trueish(r[iActive]), order: Number(r[iOrder] ?? 0),
  }));
}

export function parseTokens(rows: string[][] | undefined): Token[] {
  if (!rows || rows.length < 2) return [];
  const [h, ...d] = rows;
  const iT = idx(h, 'Token'), iP = idx(h, 'Product'), iE = idx(h, 'Email');
  const iS = idx(h, 'Status'), iA = idx(h, 'AssignedAt');
  return d.filter(r => r[iT]).map(r => ({
    token: r[iT] ?? '', product: r[iP] ?? '', email: r[iE] ?? '',
    status: r[iS] ?? '', assignedAt: r[iA] ?? '',
  }));
}

export function parseCoupons(rows: string[][] | undefined): Coupon[] {
  if (!rows || rows.length < 2) return [];
  const [h, ...d] = rows;
  const iCode = idx(h, 'Code'), iType = idx(h, 'Type'), iVal = idx(h, 'Value');
  const iMin = idx(h, 'Min Amount (SAR)'), iUses = idx(h, 'Uses Left');
  const iStart = idx(h, 'Start Date'), iEnd = idx(h, 'End Date'), iActive = idx(h, 'Active');
  const iProd = idx(h, 'Products'), iCreated = idx(h, 'CreatedAt'), iBy = idx(h, 'CreatedBy');
  return d.filter(r => r[iCode]).map(r => ({
    code: String(r[iCode] ?? '').toUpperCase().trim(),
    type: String(r[iType] ?? 'percentage').toLowerCase(),
    value: Number(r[iVal] ?? 0),
    minSAR: Number(r[iMin] ?? 0),
    usesLeft: numOrNull(r[iUses]),
    startDate: r[iStart] ?? '',
    endDate: r[iEnd] ?? '',
    active: trueish(r[iActive]),
    products: (iProd >= 0 ? r[iProd] : undefined) || 'all',
    createdAt: (iCreated >= 0 ? r[iCreated] : undefined) || '',
    createdBy: (iBy >= 0 ? r[iBy] : undefined) || 'legacy',
  }));
}

export function parseLinkbio(rows: string[][] | undefined): LinkbioItem[] {
  if (!rows || rows.length < 2) return [];
  const [h, ...d] = rows;
  const iId=idx(h,'LinkID'), iAr=idx(h,'TitleAR'), iEn=idx(h,'TitleEN'), iU=idx(h,'URL');
  const iI=idx(h,'Icon'), iD=idx(h,'Description'), iA=idx(h,'Active'), iO=idx(h,'Order'), iC=idx(h,'ClickCount');
  const items = d.filter(r => r[iId]).map(r => ({
    linkId: r[iId] ?? '', titleAR: r[iAr] ?? '', titleEN: r[iEn] ?? '', url: r[iU] ?? '',
    icon: r[iI] ?? '', description: r[iD] ?? '', active: trueish(r[iA]),
    order: Number(r[iO] ?? 0), clickCount: Number(r[iC] ?? 0),
  }));
  items.sort((a, b) => a.order - b.order);
  return items;
}

export function parseLinkbioHeader(rows: string[][] | undefined): LinkbioHeader {
  const out: LinkbioHeader = {
    photoURL: '', taglineAR: '', taglineEN: '',
    nameAR: '', subtitleAR: '', bioAR: '',
  };
  if (!rows) return out;
  for (const r of rows.slice(1)) {
    const key = String(r[0] ?? '').trim();
    const val = String(r[1] ?? '');
    if (key === 'PhotoURL') out.photoURL = val;
    else if (key === 'TaglineAR') out.taglineAR = val;
    else if (key === 'TaglineEN') out.taglineEN = val;
    else if (key === 'NameAR') out.nameAR = val;
    else if (key === 'SubtitleAR') out.subtitleAR = val;
    else if (key === 'BioAR') out.bioAR = val;
  }
  return out;
}

export function parseEmailTemplates(rows: string[][] | undefined): EmailTemplate[] {
  if (!rows || rows.length < 2) return [];
  const [h, ...d] = rows;
  const iT=idx(h,'TemplateID'), iN=idx(h,'Name'), iSA=idx(h,'SubjectAR'), iSE=idx(h,'SubjectEN');
  const iBA=idx(h,'BodyAR'), iBE=idx(h,'BodyEN'), iV=idx(h,'Variables');
  const iBlocks=idx(h,'Blocks');
  return d.filter(r => r[iT]).map(r => {
    const bodyAR = r[iBA] ?? '';
    const bodyEN = r[iBE] ?? '';
    // If Blocks col is populated, parse JSON. Else auto-migrate from BodyAR / BodyEN.
    let blocksAR: Block[] = [];
    let blocksEN: Block[] = [];
    const rawBlocks = iBlocks >= 0 ? (r[iBlocks] ?? '') : '';
    if (rawBlocks) {
      try {
        const parsed = JSON.parse(rawBlocks);
        blocksAR = Array.isArray(parsed?.AR) ? parsed.AR : [];
        blocksEN = Array.isArray(parsed?.EN) ? parsed.EN : [];
      } catch { /* fall through to auto-migrate */ }
    }
    if (!blocksAR.length && bodyAR) blocksAR = markdownToBlocks(bodyAR);
    if (!blocksEN.length && bodyEN) blocksEN = markdownToBlocks(bodyEN);
    return {
      templateId: r[iT] ?? '', name: r[iN] ?? '',
      subjectAR: r[iSA] ?? '', subjectEN: r[iSE] ?? '',
      bodyAR, bodyEN,
      variables: String(r[iV] ?? '').split(',').map(s => s.trim()).filter(Boolean),
      blocksAR, blocksEN,
    };
  });
}

async function readRange(sheets: SheetsClient, sheetId: string, range: string): Promise<string[][]> {
  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  return (res.data.values ?? []) as string[][];
}
export const readLessons = async (s: SheetsClient, id: string) => parseLessons(await readRange(s, id, 'Lessons'));
export const readTokens = async (s: SheetsClient, id: string) => parseTokens(await readRange(s, id, 'Tokens'));
export const readCoupons = async (s: SheetsClient, id: string) => parseCoupons(await readRange(s, id, 'Coupons'));
export const readLinkbio = async (s: SheetsClient, id: string) => parseLinkbio(await readRange(s, id, 'LinkInBio'));
export const readLinkbioHeader = async (s: SheetsClient, id: string) => parseLinkbioHeader(await readRange(s, id, 'LinkInBioHeader'));
export const readEmailTemplates = async (s: SheetsClient, id: string) => parseEmailTemplates(await readRange(s, id, 'EmailTemplates'));
