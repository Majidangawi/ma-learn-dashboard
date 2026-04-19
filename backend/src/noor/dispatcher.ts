import { toolRegistry, isWriteTool } from './tools.js';

export interface Dispatcher {
  readTool(name: string, input: unknown): Promise<unknown>;
  writeTool(name: string, input: unknown): Promise<unknown>;
  reasonTool(name: string, input: unknown): Promise<unknown>;
}

export interface ToolCall { name: string; input: unknown; }
export interface ToolResult { name: string; result: unknown; }

export async function dispatchToolCalls(
  calls: ToolCall[],
  d: Dispatcher,
  opts: { approveAll?: boolean } = {},
): Promise<ToolResult[]> {
  const out: ToolResult[] = [];
  for (const c of calls) {
    const t = toolRegistry.find(x => x.name === c.name);
    if (!t) throw new Error(`unknown_tool:${c.name}`);
    if (t.mode === 'read') {
      out.push({ name: c.name, result: await d.readTool(c.name, c.input) });
    } else if (t.mode === 'reason') {
      out.push({ name: c.name, result: await d.reasonTool(c.name, c.input) });
    } else if (t.mode === 'write') {
      if (!opts.approveAll) throw new Error(`requires_approval:${c.name}`);
      out.push({ name: c.name, result: await d.writeTool(c.name, c.input) });
    }
  }
  return out;
}

export function hasWriteTool(calls: ToolCall[]): boolean {
  return calls.some(c => isWriteTool(c.name));
}
