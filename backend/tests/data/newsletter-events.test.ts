import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the shared readSheet helper so the aggregator never touches Sheets.
vi.mock('../../src/data/sheets-read.js', () => ({
  readSheet: vi.fn(),
}));

import { readSheet } from '../../src/data/sheets-read.js';
import { topClickedLinks } from '../../src/data/newsletter-events.js';

const readSheetMock = readSheet as unknown as ReturnType<typeof vi.fn>;

function row(o: Record<string, string>): Record<string, string> {
  return o;
}

describe('topClickedLinks', () => {
  beforeEach(() => { readSheetMock.mockReset(); });

  it('returns urls sorted by click count descending', async () => {
    readSheetMock.mockResolvedValue([
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://a.com', Email: 'x@x' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://b.com', Email: 'y@y' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://a.com', Email: 'z@z' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://a.com', Email: 'q@q' }),
    ]);
    const out = await topClickedLinks('NL-1');
    expect(out).toEqual([
      { url: 'https://a.com', count: 3 },
      { url: 'https://b.com', count: 1 },
    ]);
  });

  it('ignores events from other newsletters', async () => {
    readSheetMock.mockResolvedValue([
      row({ NewsletterID: 'NL-OTHER', Event: 'clicked', URL: 'https://z.com', Email: 'x@x' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://a.com', Email: 'x@x' }),
    ]);
    const out = await topClickedLinks('NL-1');
    expect(out).toEqual([{ url: 'https://a.com', count: 1 }]);
  });

  it('ignores non-click events', async () => {
    readSheetMock.mockResolvedValue([
      row({ NewsletterID: 'NL-1', Event: 'opened', URL: '', Email: 'x@x' }),
      row({ NewsletterID: 'NL-1', Event: 'delivered', URL: '', Email: 'x@x' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://a.com', Email: 'x@x' }),
    ]);
    const out = await topClickedLinks('NL-1');
    expect(out).toEqual([{ url: 'https://a.com', count: 1 }]);
  });

  it('skips rows with an empty URL', async () => {
    readSheetMock.mockResolvedValue([
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: '', Email: 'x@x' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://a.com', Email: 'x@x' }),
    ]);
    const out = await topClickedLinks('NL-1');
    expect(out).toEqual([{ url: 'https://a.com', count: 1 }]);
  });

  it('honors the limit parameter', async () => {
    readSheetMock.mockResolvedValue([
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://a', Email: 'x' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://b', Email: 'x' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://b', Email: 'y' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://c', Email: 'x' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://c', Email: 'y' }),
      row({ NewsletterID: 'NL-1', Event: 'clicked', URL: 'https://c', Email: 'z' }),
    ]);
    const out = await topClickedLinks('NL-1', 2);
    expect(out).toEqual([
      { url: 'https://c', count: 3 },
      { url: 'https://b', count: 2 },
    ]);
  });

  it('returns empty array when no events exist', async () => {
    readSheetMock.mockResolvedValue([]);
    const out = await topClickedLinks('NL-1');
    expect(out).toEqual([]);
  });
});
