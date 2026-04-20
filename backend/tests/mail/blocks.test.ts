import { describe, it, expect } from 'vitest';
import { renderBlocks } from '../../src/mail/blocks.js';

describe('renderBlocks', () => {
  it('renders a Text block as paragraph', () => {
    const html = renderBlocks(
      [{ type: 'text', content: 'Hello world' }],
      'EN',
      {}
    );
    expect(html).toContain('<p');
    expect(html).toContain('Hello world');
  });

  it('renders Heading block', () => {
    const html = renderBlocks([{ type: 'heading', text: 'My heading' }], 'EN', {});
    expect(html).toContain('My heading');
    expect(html).toMatch(/font-weight:\s*bold/);
  });

  it('renders Banner block with alt + optional link', () => {
    const html = renderBlocks(
      [{ type: 'banner', url: 'https://cdn/x.jpg', alt: 'x', link: 'https://site' }],
      'EN', {}
    );
    expect(html).toContain('src="https://cdn/x.jpg"');
    expect(html).toContain('alt="x"');
    expect(html).toContain('href="https://site"');
  });

  it('renders CTA block with gold by default', () => {
    const html = renderBlocks(
      [{ type: 'cta', label: 'Watch', url: 'https://p' }],
      'EN', {}
    );
    expect(html).toContain('>Watch<');
    expect(html).toContain('href="https://p"');
    expect(html).toContain('#C9A84C');
  });

  it('renders Bullet list with RTL padding for AR', () => {
    const html = renderBlocks(
      [{ type: 'bullet_list', items: ['one', 'two'] }],
      'AR', {}
    );
    expect(html).toContain('padding-right');
    expect(html).toContain('<li');
  });

  it('substitutes variables like {name}', () => {
    const html = renderBlocks(
      [{ type: 'text', content: 'Hi {name}, welcome.' }],
      'EN',
      { name: 'Majid' }
    );
    expect(html).toContain('Hi Majid, welcome.');
  });

  it('leaves unknown variables untouched', () => {
    const html = renderBlocks(
      [{ type: 'text', content: 'Hi {unknown}' }],
      'EN', {}
    );
    expect(html).toContain('Hi {unknown}');
  });

  it('includes unsubscribe footer with variable substitution', () => {
    const html = renderBlocks([], 'EN', { unsubscribeUrl: 'https://x/u/abc' });
    expect(html).toContain('href="https://x/u/abc"');
  });

  it('sets dir="rtl" for AR language', () => {
    const html = renderBlocks([], 'AR', {});
    expect(html).toContain('dir="rtl"');
  });

  it('strips disallowed tags (e.g. <script>) from text content', () => {
    const html = renderBlocks(
      [{ type: 'text', content: '<script>alert(1)</script>hello<b>bold</b>' }],
      'EN', {}
    );
    // <script>...</script> tags are stripped entirely — only allowed tags survive.
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('</script>');
    expect(html).toContain('<b>bold</b>');
    expect(html).toContain('hello');
  });
});
