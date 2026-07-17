import { describe, expect, it } from 'vitest';

import { updateWorkspaceInput } from '@shared/schemas/workspaces.schema';
import { COLOR_PRESETS, GRADIENT_PRESETS } from '@shared/constants';

const parse = (wallpaper: unknown) =>
  updateWorkspaceInput.safeParse({ workspaceId: 'workspace_1', wallpaper });

const layer = { blur: 0, dim: 0 };

describe('wallpaper validation', () => {
  it('accepts every gradient preset the picker offers', () => {
    for (const preset of GRADIENT_PRESETS) {
      expect(parse({ kind: 'gradient', value: preset.value, ...layer }).success, preset.id).toBe(
        true,
      );
    }
  });

  it('accepts every colour preset the picker offers', () => {
    for (const color of COLOR_PRESETS) {
      expect(parse({ kind: 'color', value: color, ...layer }).success, color).toBe(true);
    }
  });

  it('accepts a stored image file name', () => {
    expect(parse({ kind: 'image', value: 'wp_0123456789abcdef.jpg', ...layer }).success).toBe(true);
  });

  it('accepts clearing the wallpaper', () => {
    expect(parse(null).success).toBe(true);
  });

  /**
   * `value` reaches `background-image` in a renderer whose `style-src` allows
   * `'unsafe-inline'`, so anything that is not the grammar of its own kind has
   * to be rejected at the boundary rather than escaped at the point of use.
   */
  describe('refuses CSS that is not the grammar of its kind', () => {
    const attacks = [
      ['a url() in a gradient', { kind: 'gradient', value: 'linear-gradient(90deg, url(https://x/a), #ffffff)' }],
      ['a bare url()', { kind: 'gradient', value: 'url(https://evil.example/pixel.png)' }],
      ['a closed declaration', { kind: 'color', value: '#fff; background-image: url(https://x/a)' }],
      ['a non-hex colour', { kind: 'color', value: 'red' }],
      ['a gradient under kind color', { kind: 'color', value: GRADIENT_PRESETS[0]!.value }],
      ['a hex colour under kind gradient', { kind: 'gradient', value: '#ffffff' }],
      ['a radial gradient', { kind: 'gradient', value: 'radial-gradient(90deg, #ffffff, #000000)' }],
      ['a third stop', { kind: 'gradient', value: 'linear-gradient(90deg, #ffffff, #000000, #ff0000)' }],
      ['an expression', { kind: 'color', value: 'expression(alert(1))' }],
    ] as const;

    for (const [name, wallpaper] of attacks) {
      it(`rejects ${name}`, () => {
        expect(parse({ ...wallpaper, ...layer }).success).toBe(false);
      });
    }
  });

  /**
   * The image branch of the media protocol resolves by file name only, so the
   * name has to be one this browser could have invented — never a path.
   */
  describe('refuses image values that are not our own file names', () => {
    const attacks = [
      ['a traversal', '../../../../etc/passwd'],
      ['a windows traversal', '..\\..\\Windows\\win.ini'],
      ['an absolute path', '/etc/passwd'],
      ['a windows absolute path', 'C:\\Windows\\win.ini'],
      ['a file url', 'file:///etc/passwd'],
      ['a data url', 'data:image/png;base64,iVBORw0KGgo='],
      ['a remote url', 'https://evil.example/a.png'],
      ['a nested name', 'wp_0123456789abcdef/../../secret.jpg'],
      ['an unsupported extension', 'wp_0123456789abcdef.svg'],
      ['no prefix', '0123456789abcdef.jpg'],
    ] as const;

    for (const [name, value] of attacks) {
      it(`rejects ${name}`, () => {
        expect(parse({ kind: 'image', value, ...layer }).success).toBe(false);
      });
    }
  });

  it('bounds blur and dim', () => {
    const value = COLOR_PRESETS[0]!;
    expect(parse({ kind: 'color', value, blur: 101, dim: 0 }).success).toBe(false);
    expect(parse({ kind: 'color', value, blur: -1, dim: 0 }).success).toBe(false);
    expect(parse({ kind: 'color', value, blur: 0, dim: 1.1 }).success).toBe(false);
    expect(parse({ kind: 'color', value, blur: 0, dim: -0.1 }).success).toBe(false);
  });

  it('refuses an unknown kind', () => {
    expect(parse({ kind: 'video', value: '#ffffff', ...layer }).success).toBe(false);
  });
});
