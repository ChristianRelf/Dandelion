import type { ReactElement } from 'react';
import { Lock, Sparkles, TriangleAlert } from 'lucide-react';
import { prettifyUrl } from '@shared/utils';
import { INTERNAL_PAGE_META, internalPageOf, isInternalUrl } from '@shared/constants';
import { Icon } from '../ui/Icon';
import { Spinner } from '../ui/Spinner';
import { useActiveTab } from '../../hooks/useBrowser';
import { useUiStore } from '../../stores/ui.store';

/** The address bar surface. Clicking it opens the omnibox seeded with the URL. */
export function AddressPill(): ReactElement {
  const tab = useActiveTab();
  const openOmnibox = useUiStore((state) => state.openOmnibox);
  const url = tab?.pendingUrl ?? tab?.url ?? '';
  const internal = isInternalUrl(url);
  const page = internal ? internalPageOf(url) : null;
  const secure = url.startsWith('https://');
  const loading = tab?.status === 'loading';
  // Named pages show their own address (`dandelion://settings`); the new-tab
  // page keeps the search prompt, since it is where a query is typed.
  const display = page && page !== 'newTab' ? url : internal ? '' : prettifyUrl(url);

  const leading = loading ? (
    <Spinner size={13} className="text-accent" />
  ) : page && page !== 'newTab' ? (
    <Icon name={INTERNAL_PAGE_META[page].icon} className="h-3.5 w-3.5 shrink-0 text-accent" />
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
      className="group flex h-8 min-w-0 flex-1 items-center gap-2 rounded-full border border-line bg-surface px-3 text-[13px] transition-[background-color,border-color,transform] duration-[var(--duration-fast)] no-drag hover:border-line-strong hover:bg-surface-hover active:scale-[0.995]"
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
