import { type ReactElement } from 'react';
import { Folder, Pause, Play, ShieldAlert, X } from 'lucide-react';
import type { Download } from '@shared/types';
import { cn } from '../../lib/cn';
import { describe, fileIconName, isActive, progressOf } from '../../lib/downloads';
import { IconButton } from '../ui/IconButton';
import { IconTile } from '../ui/IconTile';
import { Icon } from '../ui/Icon';
import { trpc } from '../../lib/trpc/client';
import { toast } from '../../stores/toast.store';

/**
 * One download: name, state, live progress and the actions valid for that
 * state. Shared by the toolbar bubble and the sidebar panel so both stay
 * identical as download behaviour grows.
 */
export function DownloadRow({ download }: { download: Download }): ReactElement {
  const { id } = download;
  const active = isActive(download);
  const malicious = download.safety === 'malicious';
  const percent = Math.round(progressOf(download) * 100);

  const act = (call: Promise<unknown>, failure: string): void =>
    void call.catch(() => toast.error(failure));

  return (
    <div className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-surface-hover">
      <IconTile size="sm">
        {malicious ? (
          <ShieldAlert className="h-4 w-4 text-danger" />
        ) : (
          <Icon name={fileIconName(download)} className="h-4 w-4" />
        )}
      </IconTile>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] text-text" title={download.filename}>
          {download.filename}
        </p>
        <p
          className={cn(
            'truncate text-[11px]',
            download.state === 'interrupted' ? 'text-danger' : 'text-faint',
          )}
        >
          {describe(download)}
        </p>

        {active && (
          <div
            className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-active"
            role="progressbar"
            aria-valuenow={download.totalBytes > 0 ? percent : undefined}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${download.filename} progress`}
          >
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-[var(--duration-fast)]"
              style={{ width: download.totalBytes > 0 ? `${percent}%` : '100%' }}
            />
          </div>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-0.5">
        {active && (
          <>
            <IconButton
              size="sm"
              aria-label={
                download.paused ? `Resume ${download.filename}` : `Pause ${download.filename}`
              }
              disabled={download.paused && !download.canResume}
              onClick={() =>
                act(
                  download.paused
                    ? trpc.downloads.resume.mutate({ downloadId: id })
                    : trpc.downloads.pause.mutate({ downloadId: id }),
                  download.paused ? 'Could not resume download' : 'Could not pause download',
                )
              }
            >
              {download.paused ? (
                <Play className="h-3.5 w-3.5" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
            </IconButton>
            <IconButton
              size="sm"
              aria-label={`Cancel ${download.filename}`}
              onClick={() =>
                act(trpc.downloads.cancel.mutate({ downloadId: id }), 'Could not cancel download')
              }
            >
              <X className="h-3.5 w-3.5" />
            </IconButton>
          </>
        )}
        {download.state === 'completed' && !malicious && (
          <IconButton
            size="sm"
            aria-label={`Show ${download.filename} in folder`}
            onClick={() =>
              act(trpc.downloads.showInFolder.mutate({ downloadId: id }), 'Could not reveal file')
            }
          >
            <Folder className="h-3.5 w-3.5" />
          </IconButton>
        )}
      </div>
    </div>
  );
}
