// backend/src/data/audit-log.ts
import type { SheetsClient } from './sheets-client.js';

export type Actor = 'majid' | 'noor';
export type Approval = 'auto' | 'approved' | 'rejected';

export interface AuditEntry {
  timestamp: string;           // ISO 8601
  actor: Actor;
  tool: string;
  inputs: unknown;
  output: unknown;
  approval: Approval;
  idempotencyKey: string;
}

/**
 * Pure — serializes an AuditEntry to the 7-column row layout of the
 * AuditLog sheet. Object fields (inputs, output) are JSON-stringified.
 */
export function buildAuditRow(entry: AuditEntry): string[] {
  return [
    entry.timestamp,
    entry.actor,
    entry.tool,
    JSON.stringify(entry.inputs),
    JSON.stringify(entry.output),
    entry.approval,
    entry.idempotencyKey,
  ];
}

/**
 * Append a row to the AuditLog tab. Does not throw on duplicate
 * idempotency keys — the caller should check via isIdempotencyKeySeen
 * before performing the underlying action.
 */
export async function appendAudit(
  sheets: SheetsClient,
  sheetId: string,
  entry: AuditEntry,
): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range: 'AuditLog!A1',
    valueInputOption: 'RAW',
    requestBody: { values: [buildAuditRow(entry)] },
  });
}

/**
 * Returns true if any existing AuditLog row has the given idempotency key.
 * Used by write-side tools to prevent duplicate sends/toggles on retry.
 */
export async function isIdempotencyKeySeen(
  sheets: SheetsClient,
  sheetId: string,
  key: string,
): Promise<boolean> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'AuditLog!G:G',  // Column G = IdempotencyKey (7th column)
  });
  const rows = (res.data.values ?? []) as string[][];
  return rows.some((r) => r[0] === key);
}

// ─── Activity rail reader ────────────────────────────────────────────

export interface ActivityEvent {
  at: string;
  type: string;
  summary: string;
  actor: string;
}

const TYPE_BY_TOOL: Record<string, string> = {
  save_lesson_media: 'lesson_save',
  save_content: 'lesson_save',
  add_lesson: 'lesson_create',
  delete_lesson: 'lesson_delete',
  send_newsletter: 'newsletter_send',
  send_test_newsletter: 'newsletter_send',
  create_coupon: 'coupon_create',
  update_coupon: 'coupon_update',
  delete_coupon: 'coupon_update',
  gift_token: 'token_gift',
  admin_gift_token: 'token_gift',
};

function humanize(tool: string): string {
  const words = tool.replace(/^admin_/, '').split('_').map(w => w.toLowerCase());
  if (words.length === 0) return tool;
  words[0] = words[0]!.charAt(0).toUpperCase() + words[0]!.slice(1);
  return words.join(' ');
}

export function buildActivityEvent(row: string[]): ActivityEvent {
  const [at, actor, tool] = row;
  return {
    at: at ?? '',
    actor: actor ?? '',
    type: TYPE_BY_TOOL[tool ?? ''] ?? 'default',
    summary: humanize(tool ?? ''),
  };
}

export async function readRecentActivity(
  sheets: SheetsClient,
  sheetId: string,
): Promise<ActivityEvent[]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'AuditLog!A:G',
  });
  const rows = (res.data.values ?? []) as string[][];
  // Assume first row may be headers; detect by timestamp not parseable.
  const data = rows.length && isNaN(Date.parse(String(rows[0]![0]))) ? rows.slice(1) : rows;
  return data
    .filter(r => r[0])
    .map(buildActivityEvent)
    .sort((a, b) => b.at.localeCompare(a.at));
}
