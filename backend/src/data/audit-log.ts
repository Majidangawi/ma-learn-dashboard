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
