import { useEffect, useState, type ReactElement } from 'react';
import { PageShell } from './PageShell';
import { DandelionMark } from '../components/brand/DandelionMark';
import { trpc } from '../lib/trpc/client';

export function AboutPage(): ReactElement {
  const [info, setInfo] = useState<{ version: string; platform: string } | null>(null);
  const [update, setUpdate] = useState<string | null>(null);

  useEffect(() => {
    void trpc.app.info
      .query()
      .then((result) => setInfo({ version: result.version, platform: result.platform }));
  }, []);

  return (
    <PageShell title="About Dandelion">
      <div className="flex flex-col items-center rounded-2xl border border-line bg-surface px-6 py-12 text-center">
        <DandelionMark className="mb-5 h-16 w-16 text-accent" />
        <h2 className="text-xl font-semibold tracking-tight">Dandelion</h2>
        <p className="mt-1 text-sm text-muted">
          Version {info?.version ?? '…'} · {info?.platform ?? ''}
        </p>
        <p className="mt-4 max-w-sm text-[13px] leading-relaxed text-muted">
          A fast, private, beautiful browser built on Electron, React and TypeScript. Workspaces,
          split view, a command palette and a local-first privacy engine.
        </p>
        <button
          type="button"
          onClick={() =>
            void trpc.app.checkForUpdates
              .mutate()
              .then((result) =>
                setUpdate(
                  result.updateAvailable
                    ? `Update available: ${result.version}`
                    : 'You are up to date.',
                ),
              )
          }
          className="mt-6 rounded-lg bg-accent px-4 py-2 text-[13px] font-medium text-accent-fg"
        >
          Check for updates
        </button>
        {update && <p className="mt-3 text-xs text-muted">{update}</p>}
      </div>
    </PageShell>
  );
}
