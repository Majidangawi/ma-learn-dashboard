import Anthropic from '@anthropic-ai/sdk';
import type { Config } from '../config.js';
import { usdCost, InMemoryCostTracker } from './cost-cap.js';
import { toolRegistry } from './tools.js';
import { systemPrompt } from './prompt.js';

export function createNoorClient(config: Config, costTracker: InMemoryCostTracker) {
  if (!config.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing');
  const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

  async function plan(
    userPrompt: string,
    conversationHistory: Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaMessageParam[] = [],
  ): Promise<{
    toolCalls: Anthropic.Messages.ToolUseBlock[];
    text: string;
    costUSD: number;
  }> {
    if (costTracker.isOverCap()) {
      throw new Error('noor_cost_cap_reached');
    }

    const msg = await anthropic.beta.promptCaching.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: systemPrompt(config.NODE_ENV),
          cache_control: { type: 'ephemeral' },
        } as Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTextBlockParam,
      ],
      tools: toolRegistry.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Beta.PromptCaching.Messages.PromptCachingBetaTool['input_schema'],
      })),
      messages: [
        ...conversationHistory,
        { role: 'user' as const, content: userPrompt },
      ],
    });

    const usage: UsageLike = {
      input_tokens: msg.usage.input_tokens,
      output_tokens: msg.usage.output_tokens,
      cache_creation_input_tokens: msg.usage.cache_creation_input_tokens ?? undefined,
      cache_read_input_tokens: msg.usage.cache_read_input_tokens ?? undefined,
    };
    const cost = usdCost(usage);
    costTracker.record(cost);

    const toolCalls = (msg.content as Anthropic.Messages.ContentBlock[]).filter(
      (b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use',
    );
    const text = (msg.content as Anthropic.Messages.ContentBlock[])
      .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n');

    return { toolCalls, text, costUSD: cost };
  }

  return { plan };
}

// Usage shape returned by the prompt-caching beta API
interface UsageLike {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}
