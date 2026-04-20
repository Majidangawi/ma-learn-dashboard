import { readSheet } from './sheets-read.js';
import type { Block } from '../mail/blocks.js';
import type { SegmentFilter } from './segment-filter.js';

export interface Newsletter {
  newsletterId: string;
  subject: string;
  preheader: string;
  language: 'AR' | 'EN';
  blocks: Block[];
  segmentFilter: SegmentFilter;
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed' | 'deleted';
  createdAt: string;
  updatedAt: string;
  scheduledAt: string;
  sentAt: string;
  recipientCount: number;
  deliveredCount: number;
  openCount: number;
  clickCount: number;
  bounceCount: number;
  unsubCount: number;
  brevoCampaignId: string;
  idempotencyKey: string;
  createdBy: string;
  cloneOf: string;
}

const STATUSES: readonly Newsletter['status'][] = [
  'draft', 'scheduled', 'sending', 'sent', 'failed', 'deleted',
];

export async function readNewsletters(): Promise<Newsletter[]> {
  const rows = await readSheet({ tab: 'Newsletters' });
  return rows.map(r => ({
    newsletterId: String(r.NewsletterID ?? ''),
    subject: String(r.Subject ?? ''),
    preheader: String(r.Preheader ?? ''),
    language: (r.Language === 'EN' ? 'EN' : 'AR') as 'AR' | 'EN',
    blocks: safeJson<Block[]>(r.Blocks, []),
    segmentFilter: safeJson<SegmentFilter>(r.SegmentFilter, {}),
    status: (STATUSES.includes(r.Status as Newsletter['status'])
      ? (r.Status as Newsletter['status'])
      : 'draft'),
    createdAt: String(r.CreatedAt ?? ''),
    updatedAt: String(r.UpdatedAt ?? ''),
    scheduledAt: String(r.ScheduledAt ?? ''),
    sentAt: String(r.SentAt ?? ''),
    recipientCount: Number(r.RecipientCount ?? 0),
    deliveredCount: Number(r.DeliveredCount ?? 0),
    openCount: Number(r.OpenCount ?? 0),
    clickCount: Number(r.ClickCount ?? 0),
    bounceCount: Number(r.BounceCount ?? 0),
    unsubCount: Number(r.UnsubCount ?? 0),
    brevoCampaignId: String(r.BrevoCampaignId ?? ''),
    idempotencyKey: String(r.IdempotencyKey ?? ''),
    createdBy: String(r.CreatedBy ?? 'majid'),
    cloneOf: String(r.CloneOf ?? ''),
  })).filter(n => n.newsletterId);
}

function safeJson<T>(s: unknown, fallback: T): T {
  try { return JSON.parse(String(s || '')) as T; } catch { return fallback; }
}
