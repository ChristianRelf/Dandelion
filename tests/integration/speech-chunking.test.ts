import { describe, expect, it } from 'vitest';

import { chunkArticle } from '@renderer/lib/speech';
import type { ReaderBlock } from '@shared/types';

const block = (type: ReaderBlock['type'], text?: string): ReaderBlock =>
  ({ type, text }) as ReaderBlock;

describe('chunkArticle', () => {
  it('keeps each chunk pointing at the block it came from', () => {
    const chunks = chunkArticle([block('h1', 'A title'), block('p', 'A paragraph.')]);

    expect(chunks).toEqual([
      { blockIndex: 0, text: 'A title' },
      { blockIndex: 1, text: 'A paragraph.' },
    ]);
  });

  it('splits a long block into sentences, so stopping and the highlight land promptly', () => {
    const long = `${'First sentence is quite long indeed. '.repeat(6)}Second one here.`;
    const chunks = chunkArticle([block('p', long)]);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.blockIndex === 0)).toBe(true);
    // Nothing is dropped on the way through.
    expect(chunks.map((chunk) => chunk.text).join(' ')).toBe(long.trim());
  });

  it('keeps short sentences together rather than queueing each one', () => {
    const chunks = chunkArticle([block('p', 'One. Two. Three.')]);

    expect(chunks).toEqual([{ blockIndex: 0, text: 'One. Two. Three.' }]);
  });

  it('leaves an over-long single sentence whole rather than breaking mid-clause', () => {
    const runOn = `${'word '.repeat(80)}end.`;
    const chunks = chunkArticle([block('p', runOn)]);

    expect(chunks).toHaveLength(1);
  });

  /** Reading alt text aloud announces decoration as if it were prose. */
  it('skips images', () => {
    const image = { type: 'img', src: 'https://x/a.png', alt: 'A photo' } as ReaderBlock;
    expect(chunkArticle([image])).toEqual([]);
    expect(chunkArticle([block('p', 'Text.'), image])).toEqual([{ blockIndex: 0, text: 'Text.' }]);
  });

  it('skips blocks with nothing to say', () => {
    expect(chunkArticle([block('p', ''), block('p', '   '), block('p')])).toEqual([]);
    expect(chunkArticle([])).toEqual([]);
  });

  it('numbers blocks by their position in the article, including skipped ones', () => {
    const chunks = chunkArticle([
      { type: 'img', src: 'https://x/a.png' } as ReaderBlock,
      block('p', 'After the image.'),
    ]);

    // The paragraph is block 1 — the highlight indexes the rendered article,
    // which still contains the image.
    expect(chunks).toEqual([{ blockIndex: 1, text: 'After the image.' }]);
  });
});
