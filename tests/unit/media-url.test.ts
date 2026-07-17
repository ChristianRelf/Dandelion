import { describe, expect, it } from 'vitest';
import { mediaUrl } from '@shared/utils';
import { MEDIA_SCHEME } from '@shared/constants';

describe('mediaUrl', () => {
  // The chrome has no session of its own, so an <img> pointed at a site-chosen
  // favicon URL fetched it in the default session — outside every profile
  // partition and outside the block engine. The address names the profile so
  // main can fetch it in the right one.
  it('routes a remote icon through the profile that owns it', () => {
    const built = mediaUrl('profile_1', 'https://example.com/favicon.ico');
    expect(built).not.toBeNull();

    const parsed = new URL(built!);
    expect(parsed.protocol).toBe(`${MEDIA_SCHEME}:`);
    expect(parsed.searchParams.get('profile')).toBe('profile_1');
    expect(parsed.searchParams.get('url')).toBe('https://example.com/favicon.ico');
  });

  // A tracker's favicon URL is chosen by the page, so it can carry anything.
  it('survives a URL carrying its own query string', () => {
    const target = 'https://tracker.example/id?u=123&t=abc#frag';
    const parsed = new URL(mediaUrl('profile_1', target)!);
    expect(parsed.searchParams.get('url')).toBe(target);
  });

  it('leaves anything that is not a remote fetch alone', () => {
    expect(mediaUrl('profile_1', null)).toBeNull();
    // A data URL is already inline — there is nothing to route.
    expect(mediaUrl('profile_1', 'data:image/png;base64,iVBOR')).toBe(
      'data:image/png;base64,iVBOR',
    );
  });

  it('escapes a profile id rather than letting it alter the query', () => {
    const parsed = new URL(mediaUrl('a&b=c', 'https://example.com/i.png')!);
    expect(parsed.searchParams.get('profile')).toBe('a&b=c');
    expect(parsed.searchParams.get('url')).toBe('https://example.com/i.png');
  });
});
