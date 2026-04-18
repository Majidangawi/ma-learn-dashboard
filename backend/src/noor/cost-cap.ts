/**
 * In-memory spend tracker. Reset across process restarts — for Plan 1
 * that's fine. Plan 2 will persist to a Sheet for month-to-date continuity.
 */
export class InMemoryCostTracker {
  private totalUSD = 0;
  constructor(private readonly capUSD: number) {}
  record(usd: number): void { this.totalUSD += usd; }
  monthToDateUSD(): number { return this.totalUSD; }
  capUSDValue(): number { return this.capUSD; }
  isOverCap(): boolean { return this.totalUSD > this.capUSD; }
  reset(): void { this.totalUSD = 0; }
}

// Anthropic Claude Opus 4.7 pricing as of April 2026.
const INPUT_USD_PER_MTOK = 15;
const OUTPUT_USD_PER_MTOK = 75;
const CACHE_WRITE_USD_PER_MTOK = 18.75;
const CACHE_READ_USD_PER_MTOK = 1.5;

export interface UsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export function usdCost(usage: UsageLike): number {
  const inTok = usage.input_tokens ?? 0;
  const outTok = usage.output_tokens ?? 0;
  const cwTok = usage.cache_creation_input_tokens ?? 0;
  const crTok = usage.cache_read_input_tokens ?? 0;
  return (
    (inTok * INPUT_USD_PER_MTOK +
      outTok * OUTPUT_USD_PER_MTOK +
      cwTok * CACHE_WRITE_USD_PER_MTOK +
      crTok * CACHE_READ_USD_PER_MTOK) / 1_000_000
  );
}
