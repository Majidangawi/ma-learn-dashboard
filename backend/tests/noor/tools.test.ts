// backend/tests/noor/tools.test.ts
import { describe, it, expect } from 'vitest';
import { toolRegistry, isWriteTool } from '../../src/noor/tools.js';

describe('toolRegistry', () => {
  it('includes read_customers as read tool', () => {
    const t = toolRegistry.find((x) => x.name === 'read_customers');
    expect(t).toBeDefined();
    expect(t?.mode).toBe('read');
    expect(isWriteTool('read_customers')).toBe(false);
  });

  it('flags toggle_lesson as write (approval required)', () => {
    expect(isWriteTool('toggle_lesson')).toBe(true);
  });

  it('does not include forbidden tools', () => {
    for (const forbidden of ['delete_sheet', 'run_arbitrary_code', 'modify_auth', 'send_bulk_email']) {
      expect(toolRegistry.find((x) => x.name === forbidden)).toBeUndefined();
    }
  });

  it('every tool has name, description, input_schema, mode', () => {
    for (const t of toolRegistry) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.input_schema).toBeTruthy();
      expect(['read', 'write', 'reason']).toContain(t.mode);
    }
  });
});
