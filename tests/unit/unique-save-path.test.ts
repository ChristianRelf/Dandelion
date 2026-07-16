import { describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { uniqueSavePath } from '@main/services/downloads.service';

/** A `taken` predicate over a fixed set of already-used paths. */
const occupied =
  (...paths: string[]) =>
  (candidate: string): boolean =>
    paths.includes(candidate);

const DIR = join('C:', 'Downloads');

describe('uniqueSavePath', () => {
  it('uses the plain name when nothing is in the way', () => {
    expect(uniqueSavePath(DIR, 'report.pdf', occupied())).toBe(join(DIR, 'report.pdf'));
  });

  // Setting an explicit save path opts out of Chromium's own uniquifying, so
  // without this walk a second download silently truncates the first.
  it('does not overwrite an existing file', () => {
    const path = uniqueSavePath(DIR, 'report.pdf', occupied(join(DIR, 'report.pdf')));
    expect(path).toBe(join(DIR, 'report (1).pdf'));
  });

  it('walks past a run of existing copies', () => {
    const path = uniqueSavePath(
      DIR,
      'report.pdf',
      occupied(join(DIR, 'report.pdf'), join(DIR, 'report (1).pdf'), join(DIR, 'report (2).pdf')),
    );
    expect(path).toBe(join(DIR, 'report (3).pdf'));
  });

  it('keeps the extension on the end rather than appending after it', () => {
    const path = uniqueSavePath(DIR, 'archive.zip', occupied(join(DIR, 'archive.zip')));
    expect(path).toBe(join(DIR, 'archive (1).zip'));
  });

  it('handles a name with no extension', () => {
    const path = uniqueSavePath(DIR, 'LICENSE', occupied(join(DIR, 'LICENSE')));
    expect(path).toBe(join(DIR, 'LICENSE (1)'));
  });

  it('treats a leading dot as part of the name, not an extension', () => {
    const path = uniqueSavePath(DIR, '.bashrc', occupied(join(DIR, '.bashrc')));
    expect(path).toBe(join(DIR, '.bashrc (1)'));
  });
});
