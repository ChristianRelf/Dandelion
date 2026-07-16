import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { ShieldCheck, X } from 'lucide-react';
import type { PermissionDecision, SitePermissionRule } from '@shared/types';
import { PageShell } from './PageShell';
import { IconButton } from '../components/ui/IconButton';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';

const DECISIONS: PermissionDecision[] = ['allow', 'ask', 'block'];

export function PermissionsPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const [rules, setRules] = useState<SitePermissionRule[]>([]);

  const load = useCallback(() => {
    if (profile) void trpc.permissions.list.query({ profileId: profile.id }).then(setRules);
  }, [profile]);

  useEffect(() => load(), [load]);

  const update = (rule: SitePermissionRule, decision: PermissionDecision): void => {
    if (!profile) return;
    void trpc.permissions.set
      .mutate({ profileId: profile.id, origin: rule.origin, type: rule.type, decision })
      .then(load);
  };

  return (
    <PageShell
      title="Site permissions"
      description="Control what each site is allowed to do."
      icon={<ShieldCheck className="h-5 w-5" />}
    >
      {rules.length === 0 ? (
        <p className="py-16 text-center text-sm text-faint">No site permissions set yet.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-line">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-text">{rule.origin}</p>
                <p className="text-xs text-faint capitalize">{rule.type.replace(/-/g, ' ')}</p>
              </div>
              <div className="flex overflow-hidden rounded-lg border border-line">
                {DECISIONS.map((decision) => (
                  <button
                    key={decision}
                    type="button"
                    onClick={() => update(rule, decision)}
                    className={`px-2.5 py-1 text-xs capitalize transition-colors ${
                      rule.decision === decision
                        ? 'bg-accent text-accent-fg'
                        : 'text-muted hover:bg-surface-hover'
                    }`}
                  >
                    {decision}
                  </button>
                ))}
              </div>
              <IconButton
                size="sm"
                onClick={() => void trpc.permissions.remove.mutate({ id: rule.id }).then(load)}
              >
                <X className="h-4 w-4" />
              </IconButton>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  );
}
