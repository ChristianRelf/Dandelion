import type { ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Download as DownloadIcon, Folder, Pause, Play, ShieldAlert, X } from 'lucide-react';
import type { Download } from '@shared/types';
import { formatBytes, formatDuration, formatSpeed } from '@shared/utils';
import { cn } from '../lib/cn';
import { PageShell } from './PageShell';
import { IconButton } from '../components/ui/IconButton';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';
import { useDownloadsStore } from '../stores/downloads.store';

function DownloadRow({ download }: { download: Download }): ReactElement {
  const progress = download.totalBytes > 0 ? download.receivedBytes / download.totalBytes : 0;
  const active = download.state === 'in_progress' || download.state === 'paused';

  return (
    <div className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface">
        {download.safety === 'malicious' ? (
          <ShieldAlert className="h-4 w-4 text-danger" />
        ) : (
          <DownloadIcon className="h-4 w-4 text-muted" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          onClick={() => void trpc.downloads.openFile.mutate({ downloadId: download.id })}
          className="block max-w-full truncate text-left text-[13.5px] text-text hover:underline"
        >
          {download.filename}
        </button>
        {active && (
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-accent transition-[width]"
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}
        <p className="mt-1 text-xs text-faint">
          {download.state === 'in_progress'
            ? `${formatBytes(download.receivedBytes)} · ${formatSpeed(download.speed)} · ${download.etaSeconds ? formatDuration(download.etaSeconds) + ' left' : '—'}`
            : download.state === 'completed'
              ? formatBytes(download.totalBytes || download.receivedBytes)
              : download.state}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {download.state === 'in_progress' && (
          <IconButton
            size="sm"
            onClick={() => void trpc.downloads.pause.mutate({ downloadId: download.id })}
          >
            <Pause className="h-4 w-4" />
          </IconButton>
        )}
        {download.state === 'paused' && (
          <IconButton
            size="sm"
            onClick={() => void trpc.downloads.resume.mutate({ downloadId: download.id })}
          >
            <Play className="h-4 w-4" />
          </IconButton>
        )}
        {download.state === 'completed' && (
          <IconButton
            size="sm"
            onClick={() => void trpc.downloads.showInFolder.mutate({ downloadId: download.id })}
          >
            <Folder className="h-4 w-4" />
          </IconButton>
        )}
        <IconButton
          size="sm"
          onClick={() => void trpc.downloads.remove.mutate({ downloadId: download.id })}
        >
          <X className="h-4 w-4" />
        </IconButton>
      </div>
    </div>
  );
}

export function DownloadsPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const downloads = useDownloadsStore(
    useShallow((state) => Object.values(state.downloads).sort((a, b) => b.startedAt - a.startedAt)),
  );

  return (
    <PageShell
      title="Downloads"
      description="Pause, resume and manage your downloads."
      icon={<DownloadIcon className="h-5 w-5" />}
      actions={
        <button
          type="button"
          onClick={() =>
            profile && void trpc.downloads.clearCompleted.mutate({ profileId: profile.id })
          }
          className="rounded-lg bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          Clear completed
        </button>
      }
    >
      {downloads.length === 0 ? (
        <p className="py-16 text-center text-sm text-faint">No downloads yet.</p>
      ) : (
        <div className={cn('overflow-hidden rounded-xl border border-line')}>
          {downloads.map((download) => (
            <DownloadRow key={download.id} download={download} />
          ))}
        </div>
      )}
    </PageShell>
  );
}
