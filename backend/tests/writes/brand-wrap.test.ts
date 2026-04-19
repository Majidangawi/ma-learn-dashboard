import { describe, it, expect } from 'vitest';
import { brandWrapEmailBody } from '../../src/writes/brand-wrap.js';

describe('brandWrapEmailBody', () => {
  it('wraps plain paragraphs in brand shell', () => {
    const out = brandWrapEmailBody('Hey {name},\n\nThanks for joining.', 'EN');
    expect(out).toContain('dir="ltr"');
    expect(out).toContain('Hey {name},');
    expect(out).toContain('Thanks for joining.');
    expect(out).toContain('Majid Angawi');
    expect(out).toContain('Making Inspiration');
  });

  it('RTL for Arabic + Arabic signature', () => {
    const out = brandWrapEmailBody('السلام عليكم.\n\nشكراً.', 'AR');
    expect(out).toContain('dir="rtl"');
    expect(out).toContain('ماجد عنقاوي');
    expect(out).toContain('صناعة الإلهام');
  });

  it('## heading becomes gold-accent bold paragraph', () => {
    const out = brandWrapEmailBody('## Module 4 is live', 'EN');
    expect(out).toMatch(/<p style="font-size:1\.1rem;font-weight:bold[^"]*">Module 4 is live<\/p>/);
  });

  it('> renders as accent box', () => {
    const out = brandWrapEmailBody('> One more module before the workshop', 'EN');
    expect(out).toContain('border-left:3px solid #C9A84C');
    expect(out).toContain('One more module before the workshop');
  });

  it('bullet list renders as <ul><li>', () => {
    const out = brandWrapEmailBody('- First point\n- Second point', 'EN');
    expect(out).toContain('<ul');
    expect(out).toContain('<li');
    expect(out).toContain('First point');
    expect(out).toContain('Second point');
  });

  it('**bold** becomes <strong>', () => {
    const out = brandWrapEmailBody('This is **important**.', 'EN');
    expect(out).toContain('<strong>important</strong>');
  });

  it('escapes HTML in plain text', () => {
    const out = brandWrapEmailBody('Script <script>alert(1)</script> attempt', 'EN');
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;');
  });

  it('RTL highlight uses border-right', () => {
    const out = brandWrapEmailBody('> test', 'AR');
    expect(out).toContain('border-right:3px solid #C9A84C');
  });
});
