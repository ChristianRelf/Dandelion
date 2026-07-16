import { useMemo, useState, type ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Download } from '@shared/types';
import { isActive } from '../../lib/downloads';
import { SearchField } from '../ui/SearchField';
import { useDownloadsStore } from '../../stores/downloads.store';
import { DownloadRow } from './DownloadRow';

function Section({ label, items }: { label: string; items: Download[] }): ReactElement | null {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col">
      <h3 className="px-1 pt-1.5 pb-0.5 text-[11px] font-semibold tracking-wide text-faint uppercase">
        {label}
      </h3>
      {items.map((download) => (
        <DownloadRow key={download.id} download={download} />
      ))}
    </section>
  );
}

/**
 * The sidebar's downloads panel: everything downloaded in this profile, with
 * transfers still running pinned above the rest so progress is never scrolled
 * out of sight. Rows are shared with the toolbar bubble; clearing the list
 * stays on the downloads page, as with the other panels.
 */
export function DownloadsPanel(): ReactElement {
  const [query, setQuery] = useState('');

  const downloads = useDownloadsStore(
    useShallow((state) => Object.values(state.downloads).sort((a, b) => b.startedAt - a.startedAt)),
  );

  const { running, finished } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const matches = needle
      ? downloads.filter((download) => download.filename.toLowerCase().includes(needle))
      : downloads;
    return {
      running: matches.filter(isActive),
      finished: matches.filter((download) => !isActive(download)),
    };
  }, [downloads, query]);

  const empty = running.length === 0 && finished.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 px-2 pt-1">
      <SearchField
        value={query}
        onChange={setQuery}
        placeholder="Search downloads"
        aria-label="Search downloads"
      />

      <div className="flex scrollbar-slim min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto pb-1">
        {empty ? (
          <p className="px-2 py-8 text-center text-[12px] text-faint">
            {query.trim() ? 'Nothing matched' : 'No downloads yet'}
          </p>
        ) : (
          <>
            <Section label="In progress" items={running} />
            <Section label="Finished" items={finished} />
          </>
        )}
      </div>
    </div>
  );
}
