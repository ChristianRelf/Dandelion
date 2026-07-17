import { useEffect, useState } from 'react';
import { Globe } from 'lucide-react';
import { faviconUrl } from '@shared/utils';
import { useBrowserStore } from '../../stores/browser.store';
import { cn } from '../../lib/cn';

/**
 * A favicon image that falls back to a globe glyph on error or when missing.
 *
 * The `src` is chosen by the site, and the chrome has no session of its own — so
 * pointing an `<img>` straight at it fetched the icon in the default session,
 * outside every profile partition and outside the block engine. It resolves the
 * address through main instead, which fetches in the owning profile's session.
 * Doing that here rather than at each call site covers the tab strip, history,
 * bookmarks and the reader by construction.
 */
export function Favicon({ src, className }: { src: string | null; className?: string }) {
  const profileId = useBrowserStore((state) => state.profile?.id);
  const [failed, setFailed] = useState(false);
  const resolved = profileId ? faviconUrl(profileId, src) : null;

  useEffect(() => setFailed(false), [resolved]);

  if (!resolved || failed) {
    return <Globe className={cn('opacity-60', className)} strokeWidth={1.75} />;
  }
  return (
    <img
      src={resolved}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn('rounded-[3px] object-contain', className)}
    />
  );
}
