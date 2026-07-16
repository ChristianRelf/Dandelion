import type { ReactElement } from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  Download as DownloadIcon,
  Folder,
  Pause,
  Play,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import type { Download, DownloadState } from '@shared/types';
import { formatBytes, formatDuration, formatRelativeTime, formatSpeed } from '@shared/utils';
import { cn } from '../lib/cn';
import { PageShell } from './PageShell';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { IconTile } from '../components/ui/IconTile';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { ListContainer } from '../components/ui/List';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';
import { useDownloadsStore } from '../stores/downloads.store';
import { toast } from '../stores/toast.store';

/** Friendly, human-readable label for each download state — never the raw enum. */
const STATE_LABEL: Record<DownloadState, string> = {
  in_progress: 'Downloading',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  interrupted: 'Failed',
};

/** Map a download to a Lucide file-type icon (kebab name) from its mime/extension. */
function fileIconName(download: Download): string {
  const mime = download.mimeType.toLowerCase();
  const ext = download.filename.includes('.')
    ? (download.filename.split('.').pop() ?? '').toLowerCase()
    : '';

  const has = (...exts: string[]): boolean => exts.includes(ext);

  if (
    mime.startsWith('image/') ||
    has('png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico', 'avif', 'heic')
  ) {
    return 'image';
  }
  if (mime.startsWith('video/') || has('mp4', 'mkv', 'mov', 'avi', 'webm', 'm4v')) return 'film';
  if (mime.startsWith('audio/') || has('mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a')) return 'music';
  if (mime === 'application/pdf' || ext === 'pdf') return 'file-text';
  if (
    has('zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz') ||
    mime.includes('zip') ||
    mime.includes('compressed') ||
    mime.includes('tar')
  ) {
    return 'file-archive';
  }
  if (has('csv', 'xls', 'xlsx') || mime.includes('spreadsheet') || mime.includes('csv')) {
    return 'file-spreadsheet';
  }
  if (
    has(
      'js',
      'ts',
      'jsx',
      'tsx',
      'json',
      'html',
      'css',
      'py',
      'rs',
      'go',
      'java',
      'c',
      'cpp',
      'sh',
      'yml',
      'yaml',
      'xml',
    ) ||
    mime.includes('json') ||
    mime.includes('javascript')
  ) {
    return 'file-code';
  }
  if (has('exe', 'dmg', 'pkg', 'deb', 'rpm', 'msi', 'appimage')) return 'package';
  if (mime.startsWith('text/') || has('txt', 'md', 'rtf', 'doc', 'docx')) return 'file-text';
  return 'file';
}

/** `12.3 MB of 40.0 MB`, or just the received size when the total is unknown. */
function sizeSummary(download: Download): string {
  if (download.totalBytes > 0) {
    return `${formatBytes(download.receivedBytes)} of ${formatBytes(download.totalBytes)}`;
  }
  return formatBytes(download.receivedBytes);
}

/** The state-aware second line: always leads with the friendly state label. */
function describe(download: Download): string {
  const label = STATE_LABEL[download.state];
  switch (download.state) {
    case 'in_progress': {
      const parts = [label, sizeSummary(download)];
      if (download.speed > 0) parts.push(formatSpeed(download.speed));
      if (download.etaSeconds != null && download.etaSeconds > 0) {
        parts.push(`${formatDuration(download.etaSeconds)} left`);
      }
      return parts.join(' · ');
    }
    case 'paused':
      return `${label} · ${sizeSummary(download)}`;
    case 'completed': {
      const size = formatBytes(download.totalBytes || download.receivedBytes);
      const when = download.completedAt ? formatRelativeTime(download.completedAt) : null;
      return when ? `${label} · ${size} · ${when}` : `${label} · ${size}`;
    }
    default:
      return label;
  }
}

function DownloadRow({ download }: { download: Download }): ReactElement {
  const { id, state } = download;
  const active = state === 'in_progress' || state === 'paused';
  const malicious = download.safety === 'malicious';
  const progress =
    download.totalBytes > 0 ? Math.min(1, download.receivedBytes / download.totalBytes) : 0;
  const percent = Math.round(progress * 100);

  const pause = (): void => {
    void trpc.downloads.pause
      .mutate({ downloadId: id })
      .catch(() => toast.error('Could not pause download'));
  };
  const resume = (): void => {
    void trpc.downloads.resume
      .mutate({ downloadId: id })
      .catch(() => toast.error('Could not resume download'));
  };
  const cancel = (): void => {
    void trpc.downloads.cancel
      .mutate({ downloadId: id })
      .catch(() => toast.error('Could not cancel download'));
  };
  const openFile = (): void => {
    void trpc.downloads.openFile
      .mutate({ downloadId: id })
      .catch(() => toast.error('Could not open file'));
  };
  const showInFolder = (): void => {
    void trpc.downloads.showInFolder
      .mutate({ downloadId: id })
      .catch(() => toast.error('Could not reveal file'));
  };
  const remove = (): void => {
    void trpc.downloads.remove
      .mutate({ downloadId: id })
      .then(() => useDownloadsStore.getState().remove(id))
      .catch(() => toast.error('Could not remove download'));
  };

  const sublineClass =
    state === 'interrupted' ? 'text-danger' : active ? 'text-muted' : 'text-faint';

  return (
    <div
      className="group flex items-start gap-3 border-b border-line px-3 transition-colors last:border-b-0 hover:bg-surface-hover"
      style={{ paddingBlock: 'var(--row-py)' }}
    >
      <IconTile className={cn(malicious && 'text-danger')}>
        {malicious ? (
          <ShieldAlert className="h-4 w-4" />
        ) : (
          <Icon name={fileIconName(download)} className="h-4 w-4" />
        )}
      </IconTile>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="min-w-0 flex-1 truncate text-[13.5px] text-text">
            {download.filename}
          </span>

          {malicious && (
            <span
              title="This file was flagged as malicious and blocked."
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-danger-soft px-1.5 py-0.5 text-[11px] font-medium text-danger"
            >
              <ShieldAlert className="h-3 w-3" />
              Blocked
            </span>
          )}

          <div className="flex h-7 shrink-0 items-center gap-1">
            {state === 'in_progress' && (
              <IconButton size="sm" aria-label="Pause download" title="Pause" onClick={pause}>
                <Pause className="h-4 w-4" />
              </IconButton>
            )}
            {state === 'paused' && download.canResume && (
              <IconButton size="sm" aria-label="Resume download" title="Resume" onClick={resume}>
                <Play className="h-4 w-4" />
              </IconButton>
            )}
            {active && (
              <IconButton size="sm" aria-label="Cancel download" title="Cancel" onClick={cancel}>
                <X className="h-4 w-4" />
              </IconButton>
            )}
            {state === 'completed' && (
              <Button variant="subtle" size="sm" className="h-7" onClick={openFile}>
                Open
              </Button>
            )}

            <div className="flex items-center gap-0.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
              {state === 'completed' && (
                <IconButton
                  size="sm"
                  aria-label="Show in folder"
                  title="Show in folder"
                  onClick={showInFolder}
                >
                  <Folder className="h-4 w-4" />
                </IconButton>
              )}
              <IconButton
                size="sm"
                aria-label="Remove from list"
                title="Remove from list"
                onClick={remove}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          </div>
        </div>

        {active && (
          <div
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${download.filename} download progress`}
            className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface"
          >
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-300 ease-out',
                state === 'paused' ? 'bg-faint' : 'bg-accent',
              )}
              style={{ width: `${Math.max(progress * 100, download.totalBytes > 0 ? 2 : 0)}%` }}
            />
          </div>
        )}

        <p className={cn('mt-1 truncate text-xs tabular-nums', sublineClass)}>
          {describe(download)}
        </p>
      </div>
    </div>
  );
}

export function DownloadsPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const downloads = useDownloadsStore(
    useShallow((state) => Object.values(state.downloads).sort((a, b) => b.startedAt - a.startedAt)),
  );

  const completedCount = downloads.reduce((n, d) => (d.state === 'completed' ? n + 1 : n), 0);

  const clearCompleted = (): void => {
    if (!profile || completedCount === 0) return;
    const cleared = completedCount;
    void trpc.downloads.clearCompleted
      .mutate({ profileId: profile.id })
      .then(() => useDownloadsStore.getState().load(profile.id))
      .then(() =>
        toast.success(
          cleared === 1 ? 'Cleared 1 completed download' : `Cleared ${cleared} completed downloads`,
        ),
      )
      .catch(() => toast.error('Could not clear downloads'));
  };

  return (
    <PageShell
      title="Downloads"
      description="Pause, resume, and manage your downloads."
      icon={<DownloadIcon className="h-5 w-5" />}
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon="list-x"
          disabled={completedCount === 0}
          onClick={clearCompleted}
        >
          Clear completed
        </Button>
      }
    >
      {downloads.length === 0 ? (
        <EmptyState
          icon="download"
          title="No downloads yet"
          description="Files you download will show up here, where you can pause, resume, and manage them."
        />
      ) : (
        <ListContainer>
          {downloads.map((download) => (
            <DownloadRow key={download.id} download={download} />
          ))}
        </ListContainer>
      )}
    </PageShell>
  );
}
