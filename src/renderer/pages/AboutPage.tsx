import { useState, type ReactElement } from 'react';
import { motion } from 'motion/react';
import { Check, Info } from 'lucide-react';
import { INTERNAL_PAGES } from '@shared/constants';
import { PageShell } from './PageShell';
import { DandelionMark } from '../components/brand/DandelionMark';
import { Button } from '../components/ui/Button';
import { Skeleton } from '../components/ui/Skeleton';
import { useAsyncData } from '../hooks/useAsyncData';
import { openInternalPage } from '../lib/commands';
import { toast } from '../stores/toast.store';
import { trpc } from '../lib/trpc/client';

interface AppInfo {
  name: string;
  version: string;
  platform: string;
}

type UpdateResult =
  | { tone: 'idle' }
  | { tone: 'current'; message: string }
  | { tone: 'available'; message: string };

const PLATFORM_LABELS: Record<string, string> = {
  darwin: 'macOS',
  win32: 'Windows',
  linux: 'Linux',
};

function platformLabel(platform: string): string {
  return PLATFORM_LABELS[platform] ?? platform;
}

function messageOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

export function AboutPage(): ReactElement {
  const { status, data: info } = useAsyncData<AppInfo | null>(
    () => trpc.app.info.query(),
    [],
    null,
  );
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<UpdateResult>({ tone: 'idle' });

  const checkForUpdates = async (): Promise<void> => {
    setChecking(true);
    try {
      const outcome = await trpc.app.checkForUpdates.mutate();
      setResult(
        outcome.updateAvailable
          ? {
              tone: 'available',
              message: `Version ${outcome.version} is available. Restart Dandelion to finish updating.`,
            }
          : { tone: 'current', message: `You're on the latest version (${outcome.version}).` },
      );
    } catch (caught) {
      setResult({ tone: 'idle' });
      toast.error('Could not check for updates', { description: messageOf(caught) });
    } finally {
      setChecking(false);
    }
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

        {status === 'ready' && info ? (
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

        <Button
          variant="primary"
          icon="refresh-cw"
          loading={checking}
          onClick={() => void checkForUpdates()}
          className="mt-6"
        >
          Check for updates
        </Button>

        <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-xs">
          {result.tone === 'available' && <span className="text-accent">{result.message}</span>}
          {result.tone === 'current' && (
            <span className="inline-flex items-center gap-1.5 text-success">
              <Check className="h-3.5 w-3.5" />
              {result.message}
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
