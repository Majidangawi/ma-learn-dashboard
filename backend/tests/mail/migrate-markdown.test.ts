import { describe, it, expect } from 'vitest';
import { markdownToBlocks } from '../../src/mail/migrate-markdown.js';

describe('markdownToBlocks', () => {
  it('converts plain text to a text block (HTML-escaped)', () => {
    const blocks = markdownToBlocks('Hello world.');
    expect(blocks).toEqual([{ type: 'text', content: 'Hello world.' }]);
  });

  it('escapes HTML special chars in plain text', () => {
    const blocks = markdownToBlocks('5 < 10 & "a"');
    expect(blocks[0]).toEqual({ type: 'text', content: '5 &lt; 10 &amp; &quot;a&quot;' });
  });

  it('converts ## heading to heading block with default level 2', () => {
    const blocks = markdownToBlocks('## Module 4 unlocked\n\nNext paragraph.');
    expect(blocks[0]).toMatchObject({ type: 'heading', text: 'Module 4 unlocked', level: 2 });
    expect(blocks[1]).toEqual({ type: 'text', content: 'Next paragraph.' });
  });

  it('converts bullet lines to a bullet_list block', () => {
    const blocks = markdownToBlocks('Intro line.\n\n- one\n- two\n- three');
    expect(blocks).toContainEqual({ type: 'bullet_list', items: ['one', 'two', 'three'] });
  });

  it('converts > quote to a quote block', () => {
    const blocks = markdownToBlocks('> Important: read this');
    expect(blocks[0].type).toBe('quote');
    expect((blocks[0] as { type: 'quote'; text: string }).text).toContain('Important: read this');
  });
});
