import type { ReactElement } from 'react';
import { Lock, Sparkles, TriangleAlert } from 'lucide-react';
import { prettifyUrl } from '@shared/utils';
import { isInternalUrl } from '@shared/constants';
import { Spinner } from '../ui/Spinner';
import { useActiveTab } from '../../hooks/useBrowser';
import { useUiStore } from '../../stores/ui.store';

/** The address bar surface. Clicking it opens the omnibox seeded with the URL. */
export function AddressPill(): ReactElement {
  const tab = useActiveTab();
  const openOmnibox = useUiStore((state) => state.openOmnibox);
  const url = tab?.pendingUrl ?? tab?.url ?? '';
  const internal = isInternalUrl(url);
  const secure = url.startsWith('https://');
  const loading = tab?.status === 'loading';
  const display = internal ? '' : prettifyUrl(url);

  const leading = loading ? (
    <Spinner size={13} className="text-accent" />
  ) : internal || !url ? (
    <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
  ) : secure ? (
    <Lock className="h-3.5 w-3.5 shrink-0 text-success" />
  ) : (
    <TriangleAlert className="h-3.5 w-3.5 shrink-0 text-warning" />
  );

  return (
    <button
      type="button"
      onClick={() => openOmnibox(display)}
      title={display || undefined}
      className="group no-drag flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] transition-[background-color,border-color,transform] duration-[var(--duration-fast)] hover:border-line-strong hover:bg-surface-hover active:scale-[0.995]"
    >
      {leading}
      <span className="min-w-0 flex-1 truncate text-left text-muted group-hover:text-text">
        {display || 'Search or enter address'}
      </span>
      {!secure && !internal && url && (
        <span className="shrink-0 text-[11px] font-medium text-warning">Not secure</span>
      )}
    </button>
  );
}
