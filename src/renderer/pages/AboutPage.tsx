import { type ReactElement } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, Check, ExternalLink, Info } from 'lucide-react';
import { INTERNAL_PAGES } from '@shared/constants';
import { formatBytes, formatRelativeTime, formatSpeed } from '@shared/utils';
import { PageShell } from './PageShell';
import { DandelionMark } from '../components/brand/DandelionMark';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { useAsyncData } from '../hooks/useAsyncData';
import { openInternalPage } from '../lib/commands';
import { openUrlOrToast } from '../lib/navigation';
import { toast } from '../stores/toast.store';
import { useUpdateStore } from '../stores/update.store';
import { trpc } from '../lib/trpc/client';

interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

const PLATFORM_LABELS: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

export function AboutPage(): ReactElement {
  const { status: infoStatus, data: info } = useAsyncData<AppInfo | null>(
    () => trpc.app.info.query(),
    [],
    null,
  );

  // The updater's state lives in main and arrives via `app:update-status`;
  // this page renders it rather than tracking an outcome of its own.
  const update = useUpdateStore((state) => state.status);

  const checkForUpdates = (): void => {
    void trpc.app.checkForUpdates.mutate().catch(() => {
      toast.error('Could not check for updates');
    });
  };

  const restart = (): void => {
    void trpc.app.installUpdate.mutate().catch(() => {
      toast.error('Could not install the update', {
        description: 'Restart Dandelion to try again.',
      });
    });
  };

  return (
    <PageShell title="About" icon={<Info className="h-5 w-5" />}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-12 text-center"
      >
        <DandelionMark className="mb-5 h-16 w-16 text-accent" />
        <h2 className="text-xl font-semibold tracking-tight text-text">Dandelion</h2>

        {infoStatus === 'ready' && info ? (
          <p className="mt-1.5 text-sm text-muted">
            Version {info.version} · {platformLabel(info.platform)}
          </p>
        ) : (
          <Skeleton className="mt-2.5 h-4 w-40" />
        )}

        <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted">
          A fast, private, beautiful browser built on Electron, React and TypeScript. Workspaces,
          split view, a command palette and a local-first privacy engine.
        </p>

        {update.phase === 'downloading' ? (
          <div className="mt-6 w-full max-w-[260px]">
            <div
              className="h-1 overflow-hidden rounded-full bg-surface-active"
              role="progressbar"
              aria-valuenow={update.total > 0 ? update.percent : undefined}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Version ${update.version} download progress`}
            >
              <div
                className="h-full rounded-full bg-accent transition-[width] duration-[var(--duration-fast)]"
                style={{ width: update.total > 0 ? `${update.percent}%` : '100%' }}
              />
            </div>
            <p className="mt-2 text-xs text-muted">
              Downloading {update.version}
              {update.bytesPerSecond > 0 && ` · ${formatSpeed(update.bytesPerSecond)}`}
            </p>
          </div>
        ) : update.phase === 'ready' ? (
          <Button variant="primary" icon="arrow-up-circle" onClick={restart} className="mt-6">
            Restart to update to {update.version}
          </Button>
        ) : (
          <Button
            variant="primary"
            icon="refresh-cw"
            loading={update.phase === 'checking'}
            onClick={checkForUpdates}
            className="mt-6"
          >
            Check for updates
          </Button>
        )}

        <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-xs">
          {update.phase === 'current' && (
            <span className="inline-flex items-center gap-1.5 text-success">
              <Check className="h-3.5 w-3.5" />
              You&apos;re on the latest version ({update.version}) · checked{' '}
              {formatRelativeTime(update.checkedAt)}
            </span>
          )}
          {update.phase === 'downloading' && update.total > 0 && (
            <span className="text-faint">
              {formatBytes(update.transferred)} of {formatBytes(update.total)}
            </span>
          )}
          {update.phase === 'ready' && (
            <button
              type="button"
              onClick={() => openUrlOrToast(update.releaseUrl, 'Could not open the release notes')}
              className="inline-flex items-center gap-1 rounded-xs text-accent transition-colors hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              What&apos;s new in {update.version}
              <ExternalLink className="h-3 w-3" />
            </button>
          )}
          {update.phase === 'error' && (
            <span className="inline-flex items-center gap-1.5 text-danger">
              <AlertTriangle className="h-3.5 w-3.5" />
              {update.message}
            </span>
          )}
        </div>
      </motion.div>

      <footer className="mt-6 flex flex-col items-center gap-3">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            icon="settings"
            onClick={() => void openInternalPage(INTERNAL_PAGES.settings)}
          >
            Settings
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon="puzzle"
            onClick={() => void openInternalPage(INTERNAL_PAGES.extensions)}
          >
            Extensions
          </Button>
        </div>
        <p className="text-[11px] text-faint">Built with Electron, React &amp; TypeScript.</p>
      </footer>
    </PageShell>
  );
}
