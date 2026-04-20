import { describe, it, expect } from 'vitest';
import { markdownToBlocks } from '../../src/mail/migrate-markdown.js';

describe('markdownToBlocks', () => {
  it('converts plain text to a text block', () => {
    const blocks = markdownToBlocks('Hello world.');
    expect(blocks).toEqual([{ type: 'text', content: 'Hello world.' }]);
  });

  it('converts ## heading to heading block', () => {
    const blocks = markdownToBlocks('## Module 4 unlocked\n\nNext paragraph.');
    expect(blocks[0]).toEqual({ type: 'heading', text: 'Module 4 unlocked' });
    expect(blocks[1]).toEqual({ type: 'text', content: 'Next paragraph.' });
  });

  it('converts bullet lines to a bullet_list block', () => {
    const blocks = markdownToBlocks('Intro line.\n\n- one\n- two\n- three');
    expect(blocks).toContainEqual({ type: 'bullet_list', items: ['one', 'two', 'three'] });
  });

  it('converts > quote to a text block with emphasis preserved as text', () => {
    const blocks = markdownToBlocks('> Important: read this');
    expect(blocks[0].type).toBe('text');
    expect((blocks[0] as { type: 'text'; content: string }).content).toContain('Important: read this');
  });
});
