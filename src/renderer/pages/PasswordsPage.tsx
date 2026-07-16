import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Eye, EyeOff, KeyRound, Lock, Plus, RefreshCw, Trash2, Unlock } from 'lucide-react';
import type { PasswordEntry } from '@shared/types';
import { PageShell } from './PageShell';
import { IconButton } from '../components/ui/IconButton';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';

function LockedState({
  profileId,
  mode,
}: {
  profileId: string;
  mode: 'setup' | 'unlock';
}): ReactElement {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (): Promise<void> => {
    setError(null);
    try {
      if (mode === 'setup') await trpc.vault.init.mutate({ profileId, masterPassword: password });
      else await trpc.vault.unlock.mutate({ profileId, masterPassword: password });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Failed');
    }
  };

  return (
    <div className="mx-auto mt-10 max-w-sm rounded-2xl border border-line bg-surface p-6 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-elevated">
        {mode === 'setup' ? (
          <KeyRound className="h-5 w-5 text-accent" />
        ) : (
          <Lock className="h-5 w-5 text-accent" />
        )}
      </div>
      <h2 className="text-base font-medium">
        {mode === 'setup' ? 'Create a master password' : 'Unlock your vault'}
      </h2>
      <p className="mt-1 text-xs text-muted">
        {mode === 'setup'
          ? 'It encrypts your passwords locally and cannot be recovered.'
          : 'Enter your master password to continue.'}
      </p>
      <input
        type="password"
        value={password}
        autoFocus
        onChange={(event) => setPassword(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && void submit()}
        placeholder="Master password"
        className="mt-4 w-full rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-text outline-none focus:border-accent"
      />
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <button
        type="button"
        onClick={() => void submit()}
        disabled={!password}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2 text-[13px] font-medium text-accent-fg disabled:opacity-40"
      >
        {mode === 'setup' ? 'Create vault' : 'Unlock'}
        <Unlock className="h-4 w-4" />
      </button>
    </div>
  );
}

function PasswordRow({
  entry,
  onChange,
}: {
  entry: PasswordEntry;
  onChange: () => void;
}): ReactElement {
  const [revealed, setRevealed] = useState<string | null>(null);

  const toggle = async (): Promise<void> => {
    if (revealed) return setRevealed(null);
    const { password } = await trpc.vault.reveal.mutate({ entryId: entry.id });
    setRevealed(password);
  };

  return (
    <div className="group flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0 hover:bg-surface-hover">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] text-text">{entry.origin}</p>
        <p className="truncate text-xs text-faint">{entry.username}</p>
      </div>
      <code className="w-40 shrink-0 truncate text-right text-xs text-muted">
        {revealed ?? '••••••••••'}
      </code>
      <IconButton size="sm" onClick={() => void toggle()}>
        {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </IconButton>
      <IconButton
        size="sm"
        className="opacity-0 group-hover:opacity-100"
        onClick={() => void trpc.vault.remove.mutate({ entryId: entry.id }).then(onChange)}
      >
        <Trash2 className="h-4 w-4" />
      </IconButton>
    </div>
  );
}

export function PasswordsPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const vault = useBrowserStore((state) => state.vault);
  const [entries, setEntries] = useState<PasswordEntry[]>([]);

  const load = useCallback(() => {
    if (profile && vault?.status === 'unlocked') {
      void trpc.vault.list.query({ profileId: profile.id }).then(setEntries);
    }
  }, [profile, vault?.status]);

  useEffect(() => load(), [load]);

  if (!profile)
    return (
      <PageShell title="Passwords">
        <div />
      </PageShell>
    );
  if (!vault || vault.status === 'uninitialised') {
    return (
      <PageShell title="Passwords" icon={<KeyRound className="h-5 w-5" />}>
        <LockedState profileId={profile.id} mode="setup" />
      </PageShell>
    );
  }
  if (vault.status === 'locked') {
    return (
      <PageShell title="Passwords" icon={<KeyRound className="h-5 w-5" />}>
        <LockedState profileId={profile.id} mode="unlock" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Passwords"
      description={`${vault.hardwareBacked ? 'OS-encrypted' : 'Encrypted'} vault · ${vault.entryCount} saved`}
      icon={<KeyRound className="h-5 w-5" />}
      actions={
        <button
          type="button"
          onClick={() => void trpc.vault.lock.mutate({ profileId: profile.id })}
          className="flex items-center gap-1.5 rounded-lg bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          <Lock className="h-4 w-4" /> Lock
        </button>
      }
    >
      <AddPasswordForm profileId={profile.id} onAdded={load} />
      {entries.length === 0 ? (
        <p className="py-12 text-center text-sm text-faint">No saved passwords.</p>
      ) : (
        <div className="mt-5 overflow-hidden rounded-xl border border-line">
          {entries.map((entry) => (
            <PasswordRow key={entry.id} entry={entry} onChange={load} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function AddPasswordForm({
  profileId,
  onAdded,
}: {
  profileId: string;
  onAdded: () => void;
}): ReactElement {
  const [origin, setOrigin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const generate = async (): Promise<void> => {
    const { password: generated } = await trpc.vault.generate.query({
      length: 20,
      uppercase: true,
      lowercase: true,
      numbers: true,
      symbols: true,
      avoidAmbiguous: true,
    });
    setPassword(generated);
  };

  const save = async (): Promise<void> => {
    if (!origin || !password) return;
    await trpc.vault.save.mutate({ profileId, origin, username, password, note: null });
    setOrigin('');
    setUsername('');
    setPassword('');
    onAdded();
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2">
      <input
        value={origin}
        onChange={(event) => setOrigin(event.target.value)}
        placeholder="example.com"
        className="min-w-32 flex-1 rounded-lg bg-bg-elevated px-3 py-2 text-sm text-text outline-none"
      />
      <input
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="Username"
        className="min-w-32 flex-1 rounded-lg bg-bg-elevated px-3 py-2 text-sm text-text outline-none"
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        className="min-w-32 flex-1 rounded-lg bg-bg-elevated px-3 py-2 text-sm text-text outline-none"
      />
      <IconButton onClick={() => void generate()} aria-label="Generate password">
        <RefreshCw className="h-4 w-4" />
      </IconButton>
      <button
        type="button"
        onClick={() => void save()}
        className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-2 text-[13px] font-medium text-accent-fg"
      >
        <Plus className="h-4 w-4" /> Save
      </button>
    </div>
  );
}
