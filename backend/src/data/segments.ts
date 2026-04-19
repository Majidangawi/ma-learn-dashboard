import type { Customer } from './sheets-read.js';

export const SEGMENTS = {
  all_buyers: (_c: Customer) => true,
  t3_buyers: (c: Customer) => c.product === 'creative-ai-workshop-t3',
  t2_buyers: (c: Customer) => c.product === 'intro-to-creative-ai',
  prompt_pack_buyers: (c: Customer) => c.product === 'prompt-pack',
  beyond_lighting_buyers: (c: Customer) => c.product === 'beyond-lighting',
} as const;

export type SegmentName = keyof typeof SEGMENTS;

export function resolveSegment(
  name: string,
  customers: Customer[],
  opts: { strict?: boolean } = {},
): Customer[] {
  const fn = (SEGMENTS as Record<string, (c: Customer) => boolean>)[name];
  if (!fn) {
    if (opts.strict) throw new Error(`unknown_segment:${name}`);
    return [];
  }
  const seen = new Set<string>();
  return customers.filter(c => {
    if (!fn(c)) return false;
    const k = c.email.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

export function substituteVariables(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => vars[key] ?? `{${key}}`);
}
