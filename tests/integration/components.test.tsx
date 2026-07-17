import { afterEach, describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DandelionMark } from '@renderer/components/brand/DandelionMark';
import { Favicon } from '@renderer/components/ui/Favicon';
import { Kbd } from '@renderer/components/ui/Kbd';
import { useBrowserStore } from '@renderer/stores/browser.store';
import type { Profile } from '@shared/types';
import { MEDIA_SCHEME } from '@shared/constants';

/**
 * `Favicon` resolves its address through the active profile, so these seed one.
 * The app never renders a favicon without one — `AppProvider` holds the whole
 * chrome behind `BootSplash` until `bootstrap()` has set it.
 */
function withProfile(): void {
  useBrowserStore.setState({ profile: { id: 'profile_1' } as Profile });
}

afterEach(() => useBrowserStore.setState({ profile: null }));

describe('brand + ui primitives', () => {
  it('renders the Dandelion logo as an SVG', () => {
    const { container } = render(<DandelionMark className="h-4 w-4" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('falls back to a glyph when a favicon is missing', () => {
    withProfile();
    const { container } = render(<Favicon src={null} />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders an image when a favicon src is provided', () => {
    withProfile();
    const { container } = render(<Favicon src="https://example.com/favicon.ico" />);
    expect(container.querySelector('img')).not.toBeNull();
  });

  // The point of the component: the site's URL must never reach the DOM, or the
  // chrome fetches it in the default session — outside every profile partition
  // and outside the block engine.
  it('never puts the site-chosen URL in the img src', () => {
    withProfile();
    const { container } = render(<Favicon src="https://tracker.example/id?u=123" />);
    const src = container.querySelector('img')?.getAttribute('src') ?? '';
    expect(src.startsWith(`${MEDIA_SCHEME}://`)).toBe(true);
    expect(src).not.toMatch(/^https:/);
  });

  it('renders keyboard hints', () => {
    const { getByText } = render(<Kbd>⌘K</Kbd>);
    expect(getByText('⌘K')).toBeInTheDocument();
  });
});
