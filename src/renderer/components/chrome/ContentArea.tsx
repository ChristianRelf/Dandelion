import type { ReactElement } from 'react';
import { internalPageOf, isInternalUrl } from '@shared/constants';
import { cn } from '../../lib/cn';
import { useActiveTab } from '../../hooks/useBrowser';
import { useBrowserStore } from '../../stores/browser.store';
import { selectContentTopInset, useUiStore } from '../../stores/ui.store';
import { useReaderStore } from '../../stores/reader.store';
import { InternalPage } from '../../pages/InternalPage';
import { ReaderView } from '../reader/ReaderView';
import { ContentSlot } from './ContentSlot';
import { FindBar } from './FindBar';
import { PermissionPrompt } from './PermissionPrompt';

/**
 * The web content region. For internal `dandelion://` pages it renders the React
 * page directly; for web pages it renders a {@link ContentSlot} that the main
 * process fills with the tab's WebContentsView. Owns the in-content overlays
 * (find bar, permission prompt) so they layer correctly above the content.
 */
export function ContentArea(): ReactElement {
  const tab = useActiveTab();
  const layout = useBrowserStore((state) => state.settings?.behavior.defaultTabLayout ?? 'vertical');
  const sidebarCollapsed = useUiStore((state) => state.sidebarCollapsed);
  const topInset = useUiStore(selectContentTopInset);
  const readerTabId = useReaderStore((state) => state.tabId);
  const internalPage = tab && isInternalUrl(tab.url) ? internalPageOf(tab.url) : null;
  const readerActive = !!tab && readerTabId === tab.id;
  const sidebarVisible = layout === 'vertical' && !sidebarCollapsed;

  return (
    <div
      className={cn(
        'relative m-2 flex min-h-0 flex-1 overflow-hidden rounded-xl bg-bg-elevated shadow-[var(--shadow-glass)]',
        sidebarVisible ? 'ml-0' : 'ml-2',
      )}
    >
      {readerActive ? (
        <ReaderView />
      ) : internalPage ? (
        <div
          className="scrollbar-slim h-full w-full overflow-y-auto"
          style={topInset ? { paddingTop: topInset } : undefined}
        >
          <InternalPage page={internalPage} />
        </div>
      ) : (
        <ContentSlot topInset={topInset} />
      )}

      <FindBar />
      <PermissionPrompt />
    </div>
  );
}
