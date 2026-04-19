import { describe, it, expect } from 'vitest';
import { dispatchToolCalls, type Dispatcher } from '../../src/noor/dispatcher.js';

describe('dispatchToolCalls', () => {
  it('runs read tools without approval and collects results', async () => {
    const d: Dispatcher = {
      async readTool(name, input) { return { ran: name, input }; },
      async writeTool() { throw new Error('should not be called for read-only plan'); },
      async reasonTool(name, input) { return { r: name, input }; },
    };
    const r = await dispatchToolCalls([
      { name: 'read_customers', input: {} },
      { name: 'get_current_time', input: {} },
    ], d);
    expect(r).toEqual([
      { name: 'read_customers', result: { ran: 'read_customers', input: {} } },
      { name: 'get_current_time', result: { r: 'get_current_time', input: {} } },
    ]);
  });

  it('refuses to run write tools without approval token', async () => {
    const d: Dispatcher = {
      async readTool() { return {}; },
      async writeTool() { throw new Error('should_not_run'); },
      async reasonTool() { return {}; },
    };
    await expect(dispatchToolCalls(
      [{ name: 'toggle_lesson', input: { lessonId: 'L1', active: true } }], d,
    )).rejects.toThrow(/requires_approval/);
  });

  it('runs write tools when approveAll=true', async () => {
    const d: Dispatcher = {
      async readTool() { return {}; },
      async writeTool(name, input) { return { wrote: name, input }; },
      async reasonTool() { return {}; },
    };
    const r = await dispatchToolCalls(
      [{ name: 'toggle_lesson', input: { lessonId: 'L1', active: true } }],
      d, { approveAll: true },
    );
    expect(r[0].result).toEqual({ wrote: 'toggle_lesson', input: { lessonId: 'L1', active: true } });
  });
});
