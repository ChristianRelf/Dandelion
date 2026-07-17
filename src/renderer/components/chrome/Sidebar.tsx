import { type ReactElement } from 'react';
import { WorkspaceBar } from './WorkspaceBar';
import { TabsPanel } from './TabsPanel';
import { BookmarksPanel } from './BookmarksPanel';
import { ReadingListPanel } from './ReadingListPanel';
import { NotesPanel } from './NotesPanel';
import { HistoryPanel } from './HistoryPanel';
import { DownloadsPanel } from './DownloadsPanel';
import { SegmentedControl, type SegmentOption } from '../ui/SegmentedControl';
import { useUiStore, type SidebarPanel } from '../../stores/ui.store';

const PANEL_OPTIONS: Array<SegmentOption<SidebarPanel>> = [
  { value: 'tabs', label: 'Tabs', icon: 'panel-top' },
  { value: 'bookmarks', label: 'Bookmarks', icon: 'bookmark' },
  { value: 'reading', label: 'Reading list', icon: 'book-open' },
  { value: 'notes', label: 'Notes', icon: 'sticky-note' },
  { value: 'history', label: 'History', icon: 'history' },
  { value: 'downloads', label: 'Downloads', icon: 'download' },
];

const PANELS: Record<SidebarPanel, () => ReactElement> = {
  tabs: TabsPanel,
  bookmarks: BookmarksPanel,
  reading: ReadingListPanel,
  notes: NotesPanel,
  history: HistoryPanel,
  downloads: DownloadsPanel,
};

/**
 * The vertical (Arc/Zen-style) sidebar. It owns the frame — panel switcher at
 * the top, spaces at the bottom — and hands the space between to whichever
 * panel is selected.
 */
export function Sidebar(): ReactElement {
  const panel = useUiStore((state) => state.sidebarPanel);
  const setPanel = useUiStore((state) => state.setSidebarPanel);
  const Panel = PANELS[panel];

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col">
      <div className="px-2 pt-1">
        <SegmentedControl
          size="sm"
          iconOnly
          value={panel}
          options={PANEL_OPTIONS}
          onChange={setPanel}
          aria-label="Sidebar panel"
        />
      </div>

      <Panel />

      <WorkspaceBar />
    </aside>
  );
}
