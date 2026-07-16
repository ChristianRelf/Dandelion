import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Cookie, Search, Trash2 } from 'lucide-react';
import type { CookieRecord } from '@shared/types';
import { PageShell } from './PageShell';
import { IconButton } from '../components/ui/IconButton';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';

export function CookiesPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const [domain, setDomain] = useState('');
  const [cookies, setCookies] = useState<CookieRecord[]>([]);

  const load = useCallback(() => {
    if (profile) {
      void trpc.cookies.list
        .query({ profileId: profile.id, domain: domain || undefined })
        .then((list) => setCookies(list.slice(0, 500)));
    }
  }, [profile, domain]);

  useEffect(() => {
    const timer = setTimeout(load, 150);
    return () => clearTimeout(timer);
  }, [load]);

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
      .then(load);
  };

  return (
    <PageShell
      title="Cookies"
      description="Inspect and remove stored cookies."
      icon={<Cookie className="h-5 w-5" />}
    >
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-line bg-surface px-3">
        <Search className="h-4 w-4 text-faint" />
        <input
          value={domain}
          onChange={(event) => setDomain(event.target.value)}
          placeholder="Filter by domain"
          className="flex-1 bg-transparent py-2.5 text-sm text-text outline-none placeholder:text-faint"
        />
      </div>

      {cookies.length === 0 ? (
        <p className="py-16 text-center text-sm text-faint">No cookies found.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          {cookies.map((cookie) => (
            <div
              key={`${cookie.domain}${cookie.path}${cookie.name}`}
              className="group flex items-center gap-3 border-b border-line px-3 py-2 last:border-b-0 hover:bg-surface-hover"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-text">{cookie.name}</p>
                <p className="truncate text-xs text-faint">
                  {cookie.domain}
                  {cookie.path}
                  {cookie.secure ? ' · Secure' : ''}
                  {cookie.httpOnly ? ' · HttpOnly' : ''}
                </p>
              </div>
              <IconButton
                size="sm"
                className="opacity-0 group-hover:opacity-100"
                onClick={() => remove(cookie)}
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
