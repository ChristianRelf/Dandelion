import type { ReactElement } from 'react';
import type { Tab } from '@shared/types';
import { INTERNAL_PAGE_META, internalPageOf, isInternalUrl } from '@shared/constants';
import { Icon } from '../ui/Icon';
import { Favicon } from '../ui/Favicon';

/**
 * A tab's leading glyph: the browser's own pages have no favicon of their own,
 * so they show their {@link INTERNAL_PAGE_META} icon; every other tab shows its
 * site favicon. Shared by the vertical and horizontal strips so both label a
 * `dandelion://` tab with the same mark.
 */
export function TabGlyph({ tab, className }: { tab: Tab; className?: string }): ReactElement {
  const page = isInternalUrl(tab.url) ? internalPageOf(tab.url) : null;
  if (page) {
    return <Icon name={INTERNAL_PAGE_META[page].icon} className={className} strokeWidth={2} />;
  }
  return <Favicon src={tab.favicon} className={className} />;
}
