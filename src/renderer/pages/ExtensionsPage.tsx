import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Puzzle, Trash2, Upload } from 'lucide-react';
import { PageShell } from './PageShell';
import { IconButton } from '../components/ui/IconButton';
import { trpc } from '../lib/trpc/client';

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
}

export function ExtensionsPage(): ReactElement {
  const [extensions, setExtensions] = useState<ExtensionInfo[]>([]);

  const load = useCallback(() => {
    void trpc.extensions.list.query().then(setExtensions);
  }, []);

  useEffect(() => load(), [load]);

  return (
    <PageShell
      title="Extensions"
      description="Load unpacked Manifest V3 extensions into the default profile."
      icon={<Puzzle className="h-5 w-5" />}
      actions={
        <button
          type="button"
          onClick={() => void trpc.extensions.loadUnpacked.mutate().then(load)}
          className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[13px] font-medium text-accent-fg"
        >
          <Upload className="h-4 w-4" /> Load unpacked
        </button>
      }
    >
      {extensions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-faint">
          No extensions installed. Load an unpacked extension folder to get started.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          {extensions.map((extension) => (
            <div
              key={extension.id}
              className="group flex items-center gap-3 border-b border-line px-3 py-3 last:border-b-0"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface">
                <Puzzle className="h-4 w-4 text-muted" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-text">{extension.name}</p>
                <p className="text-xs text-faint">v{extension.version}</p>
              </div>
              <IconButton
                size="sm"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => void trpc.extensions.remove.mutate({ id: extension.id }).then(load)}
              >
                <Trash2 className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
