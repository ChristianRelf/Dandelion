import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { Cookie, Trash2 } from 'lucide-react';
import type { CookieRecord } from '@shared/types';
import { PageShell } from './PageShell';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { EmptyState } from '../components/ui/EmptyState';
import { SearchField } from '../components/ui/SearchField';
import { ListContainer, ListRow } from '../components/ui/List';
import { Skeleton } from '../components/ui/Skeleton';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';
import { useAsyncData } from '../hooks/useAsyncData';
import { toast } from '../stores/toast.store';

const MAX_VISIBLE = 500;

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/** Skeleton placeholders shown during the first load. */
function LoadingRows(): ReactElement {
  return (
    <ListContainer>
      {Array.from({ length: 8 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 px-3"
          style={{ paddingBlock: 'var(--row-py)' }}
        >
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
        </div>
      ))}
    </ListContainer>
  );
}

export function CookiesPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const [domain, setDomain] = useState('');
  const [debounced, setDebounced] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(domain), 150);
    return () => clearTimeout(timer);
  }, [domain]);

  const {
    status,
    data: cookies,
    error,
    reload,
  } = useAsyncData<CookieRecord[]>(
    () =>
      profile
        ? trpc.cookies.list.query({ profileId: profile.id, domain: debounced || undefined })
        : Promise.resolve([]),
    [profile?.id, debounced],
    [],
  );

  const total = cookies.length;
  const visible = useMemo(() => cookies.slice(0, MAX_VISIBLE), [cookies]);
  const truncated = total > MAX_VISIBLE;

  const remove = (cookie: CookieRecord): void => {
    if (!profile) return;
    void trpc.cookies.remove
      .mutate({
        profileId: profile.id,
        name: cookie.name,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
      })
      .then(() => reload())
      .catch(() => toast.error('Failed to remove cookie'));
  };

  const clearAll = async (): Promise<void> => {
    if (!profile) return;
    setClearing(true);
    try {
      await Promise.all(
        cookies.map((cookie) =>
          trpc.cookies.remove.mutate({
            profileId: profile.id,
            name: cookie.name,
            domain: cookie.domain,
            path: cookie.path,
            secure: cookie.secure,
          }),
        ),
      );
      toast.success(`Cleared ${plural(total, 'cookie')}`);
      reload();
    } catch {
      toast.error('Failed to clear cookies');
    } finally {
      setClearing(false);
    }
  };

  function renderBody(): ReactElement {
    if (status === 'loading' && cookies.length === 0) return <LoadingRows />;
    if (status === 'error') {
      return (
        <EmptyState
          icon="triangle-alert"
          title="Couldn't load cookies"
          description={error ?? undefined}
          action={
            <Button icon="rotate-cw" onClick={reload}>
              Retry
            </Button>
          }
        />
      );
    }
    if (cookies.length === 0) {
      return domain.trim() ? (
        <EmptyState
          icon="search"
          title="No results"
          description={`No cookies match "${domain.trim()}".`}
        />
      ) : (
        <EmptyState
          icon="cookie"
          title="No cookies stored"
          description="Cookies set by the sites you visit will appear here."
        />
      );
    }

    return (
      <>
        {truncated && (
          <p className="mb-3 text-xs text-faint">
            Showing first {MAX_VISIBLE.toLocaleString()} of {total.toLocaleString()} cookies.
          </p>
        )}
        <ListContainer>
          {visible.map((cookie) => {
            const flags = [
              cookie.secure && 'Secure',
              cookie.httpOnly && 'HttpOnly',
              cookie.session && 'Session',
            ]
              .filter(Boolean)
              .join(' · ');
            return (
              <ListRow
                key={`${cookie.domain}${cookie.path}${cookie.name}`}
                title={cookie.domain}
                subtitle={`${cookie.name}${cookie.path !== '/' ? `  ·  ${cookie.path}` : ''}`}
                meta={flags || undefined}
                actions={
                  <IconButton
                    size="sm"
                    aria-label={`Remove cookie ${cookie.name} from ${cookie.domain}`}
                    onClick={() => remove(cookie)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                }
              />
            );
          })}
        </ListContainer>
      </>
    );
  }

  return (
    <PageShell
      title="Cookies"
      description="Inspect and remove stored cookies."
      icon={<Cookie className="h-5 w-5" />}
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon="trash-2"
          loading={clearing}
          disabled={status !== 'ready' || cookies.length === 0}
          onClick={() => setConfirmOpen(true)}
        >
          Clear all
        </Button>
      }
    >
      <SearchField
        value={domain}
        onChange={setDomain}
        placeholder="Filter by domain"
        aria-label="Filter cookies by domain"
        className="mb-5"
      />

      {renderBody()}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Clear all cookies?"
        description={`This removes ${plural(total, 'cookie')}${
          debounced.trim() ? ` for "${debounced.trim()}"` : ''
        }. Sites may sign you out.`}
        confirmLabel="Clear cookies"
        destructive
        onConfirm={() => void clearAll()}
      />
    </PageShell>
  );
}
