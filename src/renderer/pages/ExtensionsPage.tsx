import { useState, type ReactElement } from 'react';
import { Puzzle, Trash2 } from 'lucide-react';
import { PageShell } from './PageShell';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { IconTile } from '../components/ui/IconTile';
import { Switch } from '../components/ui/Switch';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ListContainer, ListRow } from '../components/ui/List';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useAsyncData } from '../hooks/useAsyncData';
import { toast } from '../stores/toast.store';
import { trpc } from '../lib/trpc/client';

interface ExtensionInfo {
  id: string;
  name: string;
  version: string;
  enabled: boolean;
}

export function ExtensionsPage(): ReactElement {
  const {
    status,
    data: extensions,
    error,
    reload,
  } = useAsyncData<ExtensionInfo[]>(() => trpc.extensions.list.query(), [], []);
  const [loadingUnpacked, setLoadingUnpacked] = useState(false);
  const [removing, setRemoving] = useState<ExtensionInfo | null>(null);

  const loadUnpacked = async (): Promise<void> => {
    setLoadingUnpacked(true);
    try {
      const result = await trpc.extensions.loadUnpacked.mutate();
      if (result) {
        toast.success(`Loaded ${result.name}`);
        reload();
      }
    } catch (loadError) {
      toast.error('Failed to load extension', {
        description: loadError instanceof Error ? loadError.message : undefined,
      });
    } finally {
      setLoadingUnpacked(false);
    }
  };

  const setEnabled = (extension: ExtensionInfo, enabled: boolean): void => {
    void trpc.extensions.setEnabled
      .mutate({ id: extension.id, enabled })
      .then(reload)
      .catch(() => toast.error(`Couldn't ${enabled ? 'enable' : 'disable'} ${extension.name}`));
  };

  const remove = (extension: ExtensionInfo): void => {
    void trpc.extensions.remove
      .mutate({ id: extension.id })
      .then(() => {
        toast.success(`Removed ${extension.name}`);
        reload();
      })
      .catch(() => toast.error(`Couldn't remove ${extension.name}`));
  };

  const loadButton = (
    <Button icon="upload" loading={loadingUnpacked} onClick={() => void loadUnpacked()}>
      Load unpacked
    </Button>
  );

  return (
    <PageShell
      title="Extensions"
      description="Load unpacked Manifest V3 extensions into the default profile."
      icon={<Puzzle className="h-5 w-5" />}
      actions={loadButton}
    >
      {status === 'loading' && (
        <ListContainer>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-3 py-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </ListContainer>
      )}

      {status === 'error' && (
        <EmptyState
          icon="triangle-alert"
          title="Couldn't load extensions"
          description={error ?? undefined}
          action={
            <Button icon="rotate-cw" variant="secondary" onClick={reload}>
              Retry
            </Button>
          }
        />
      )}

      {status === 'ready' &&
        (extensions.length === 0 ? (
          <EmptyState
            icon="puzzle"
            title="No extensions installed"
            description="Load an unpacked extension folder to add browser extensions."
            action={loadButton}
          />
        ) : (
          <ListContainer>
            {extensions.map((extension) => (
              <ListRow
                key={extension.id}
                leading={
                  <IconTile>
                    <Puzzle className="h-4 w-4" />
                  </IconTile>
                }
                title={extension.name}
                subtitle={`v${extension.version}${extension.enabled ? '' : ' · Disabled'}`}
                meta={
                  <Switch
                    checked={extension.enabled}
                    onCheckedChange={(value) => setEnabled(extension, value)}
                  />
                }
                actions={
                  <IconButton
                    size="sm"
                    aria-label={`Remove ${extension.name}`}
                    onClick={() => setRemoving(extension)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                }
              />
            ))}
          </ListContainer>
        ))}

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? 'extension'}?`}
        description="The extension will be unloaded and removed from this profile."
        confirmLabel="Remove"
        destructive
        onConfirm={() => removing && remove(removing)}
      />
    </PageShell>
  );
}
