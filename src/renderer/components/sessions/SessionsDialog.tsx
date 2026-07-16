import type { ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Layers, RotateCcw, Trash2 } from 'lucide-react';
import type { SessionSummary } from '@shared/types';
import { formatRelativeTime } from '@shared/utils';
import { Button } from '../ui/Button';
import { IconButton } from '../ui/IconButton';
import { IconTile } from '../ui/IconTile';
import { Skeleton } from '../ui/Skeleton';
import { EmptyState } from '../ui/EmptyState';
import { ListContainer, ListRow } from '../ui/List';
import { useAsyncData } from '../../hooks/useAsyncData';
import { toast } from '../../stores/toast.store';
import { trpc } from '../../lib/trpc/client';
import { useUiStore } from '../../stores/ui.store';

const REASON_LABEL: Record<SessionSummary['reason'], string> = {
  manual: 'Saved',
  shutdown: 'On quit',
  auto: 'Auto',
};

function SessionsBody({ close }: { close: () => void }): ReactElement {
  const { status, data: sessions, reload } = useAsyncData<SessionSummary[]>(
    () => trpc.sessions.list.query(),
    [],
    [],
  );

  const saveCurrent = (): void => {
    void trpc.sessions.saveCurrent
      .mutate()
      .then(() => {
        toast.success('Session saved');
        reload();
      })
      .catch(() => toast.error('Could not save session'));
  };

  const restore = (session: SessionSummary): void => {
    void trpc.sessions.restore
      .mutate({ id: session.id })
      .then((count) => {
        toast.success(`Restored ${count} ${count === 1 ? 'tab' : 'tabs'}`);
        close();
      })
      .catch(() => toast.error('Could not restore session'));
  };

  const remove = (session: SessionSummary): void => {
    void trpc.sessions.remove.mutate({ id: session.id }).then(reload).catch(() => undefined);
  };

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Dialog.Title className="text-[15px] font-semibold text-text">Sessions</Dialog.Title>
          <Dialog.Description className="mt-0.5 text-[13px] text-muted">
            Save the current set of tabs and reopen it later.
          </Dialog.Description>
        </div>
        <Button icon="save" size="sm" onClick={saveCurrent}>
          Save current
        </Button>
      </div>

      {status === 'loading' && (
        <ListContainer>
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center gap-3 px-3 py-2.5">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-48" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </ListContainer>
      )}

      {status === 'ready' &&
        (sessions.length === 0 ? (
          <EmptyState
            compact
            icon="layers"
            title="No saved sessions"
            description="Save the current window to reopen these tabs another time."
          />
        ) : (
          <ListContainer>
            {sessions.map((session) => (
              <ListRow
                key={session.id}
                leading={
                  <IconTile>
                    <Layers className="h-4 w-4" />
                  </IconTile>
                }
                title={session.title}
                subtitle={`${session.tabCount} ${session.tabCount === 1 ? 'tab' : 'tabs'} · ${REASON_LABEL[session.reason]} · ${formatRelativeTime(session.createdAt)}`}
                actions={
                  <>
                    <IconButton
                      size="sm"
                      aria-label="Restore session"
                      onClick={() => restore(session)}
                    >
                      <RotateCcw className="h-4 w-4" />
                    </IconButton>
                    <IconButton
                      size="sm"
                      aria-label="Delete session"
                      onClick={() => remove(session)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </>
                }
              />
            ))}
          </ListContainer>
        ))}
    </>
  );
}

/** Saved-sessions manager: save the current window and restore earlier ones. */
export function SessionsDialog(): ReactElement {
  const open = useUiStore((state) => state.sessionsOpen);
  const close = useUiStore((state) => state.closeSessions);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <Dialog.Content className="animate-pop fixed top-1/2 left-1/2 z-[101] max-h-[80vh] w-[520px] max-w-[92vw] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-line p-5 shadow-[var(--shadow-lg)] glass-strong scrollbar-slim">
          {open && <SessionsBody close={close} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
