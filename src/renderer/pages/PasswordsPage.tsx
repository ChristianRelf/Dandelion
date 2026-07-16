import { useRef, useState, type ReactElement, type RefObject } from 'react';
import { motion } from 'motion/react';
import { Check, Copy, Eye, EyeOff, KeyRound, Lock, Trash2 } from 'lucide-react';
import type { PasswordEntry, VaultState } from '@shared/types';
import { getHostname } from '@shared/utils';
import { PageShell } from './PageShell';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { IconTile } from '../components/ui/IconTile';
import { EmptyState } from '../components/ui/EmptyState';
import { ListContainer, ListRow } from '../components/ui/List';
import { Skeleton } from '../components/ui/Skeleton';
import { Spinner } from '../components/ui/Spinner';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { cn } from '../lib/cn';
import { useAsyncData } from '../hooks/useAsyncData';
import { toast } from '../stores/toast.store';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';

function messageOf(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined;
}

function plural(count: number, noun: string): string {
  return `${count} ${count === 1 ? noun : `${noun}s`}`;
}

/**
 * Approximate the plaintext length from the base64 AES-256-GCM ciphertext
 * (12-byte IV + 16-byte tag + plaintext) so the masked value hints at the real
 * length instead of a fixed run of dots. Clamped to a sensible range.
 */
function approximateLength(cipher: string): number {
  const bytes = Math.floor((cipher.replace(/=+$/, '').length * 3) / 4);
  return Math.min(28, Math.max(6, bytes - 28));
}

const FIELD_CLASS =
  'min-w-40 flex-1 rounded-lg border border-line bg-bg-elevated px-3 py-2 text-sm text-text ' +
  'transition-[border-color,box-shadow] outline-none placeholder:text-faint ' +
  'focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30';

/* ------------------------------------------------------------------ *
 * Locked / setup state
 * ------------------------------------------------------------------ */

function LockedState({
  profileId,
  mode,
}: {
  profileId: string;
  mode: 'setup' | 'unlock';
}): ReactElement {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    if (!password || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === 'setup') await trpc.vault.init.mutate({ profileId, masterPassword: password });
      else await trpc.vault.unlock.mutate({ profileId, masterPassword: password });
      // On success a `vault:state` event flips the page and unmounts this view.
    } catch (caught) {
      setError(messageOf(caught) ?? 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
      className="mx-auto mt-10 max-w-sm rounded-2xl border border-line bg-surface p-6 text-center"
    >
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-bg-elevated">
        {mode === 'setup' ? (
          <KeyRound className="h-5 w-5 text-accent" />
        ) : (
          <Lock className="h-5 w-5 text-accent" />
        )}
      </div>
      <h2 className="text-base font-medium text-text">
        {mode === 'setup' ? 'Create a master password' : 'Unlock your vault'}
      </h2>
      <p className="mx-auto mt-1 max-w-xs text-xs leading-relaxed text-muted">
        {mode === 'setup'
          ? 'It encrypts your passwords locally and cannot be recovered.'
          : 'Enter your master password to continue.'}
      </p>
      <input
        type="password"
        value={password}
        autoFocus
        disabled={busy}
        onChange={(event) => {
          setPassword(event.target.value);
          if (error) setError(null);
        }}
        onKeyDown={(event) => event.key === 'Enter' && void submit()}
        placeholder="Master password"
        aria-label="Master password"
        aria-invalid={error ? true : undefined}
        className={cn('mt-4 w-full', FIELD_CLASS)}
      />
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}
      <Button
        variant="primary"
        fullWidth
        loading={busy}
        disabled={!password}
        iconRight={mode === 'setup' ? undefined : 'unlock'}
        onClick={() => void submit()}
        className="mt-4"
      >
        {mode === 'setup' ? 'Create vault' : 'Unlock'}
      </Button>
    </motion.div>
  );
}

/* ------------------------------------------------------------------ *
 * Add-password form
 * ------------------------------------------------------------------ */

function AddPasswordForm({
  profileId,
  onAdded,
  originRef,
}: {
  profileId: string;
  onAdded: () => void;
  originRef: RefObject<HTMLInputElement | null>;
}): ReactElement {
  const [origin, setOrigin] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const canSave = origin.trim().length > 0 && password.length > 0;

  const generate = async (): Promise<void> => {
    setGenerating(true);
    try {
      const { password: generated } = await trpc.vault.generate.query({
        length: 20,
        uppercase: true,
        lowercase: true,
        numbers: true,
        symbols: true,
        avoidAmbiguous: true,
      });
      setPassword(generated);
    } catch (caught) {
      toast.error('Could not generate a password', { description: messageOf(caught) });
    } finally {
      setGenerating(false);
    }
  };

  const save = async (): Promise<void> => {
    if (!canSave || saving) return;
    setSaving(true);
    try {
      await trpc.vault.save.mutate({
        profileId,
        origin: origin.trim(),
        username: username.trim(),
        password,
        note: null,
      });
      setOrigin('');
      setUsername('');
      setPassword('');
      toast.success('Password saved');
      onAdded();
      originRef.current?.focus();
    } catch (caught) {
      toast.error('Could not save password', { description: messageOf(caught) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2"
    >
      <input
        ref={originRef}
        value={origin}
        onChange={(event) => setOrigin(event.target.value)}
        placeholder="example.com"
        aria-label="Website"
        spellCheck={false}
        autoCapitalize="none"
        className={FIELD_CLASS}
      />
      <input
        value={username}
        onChange={(event) => setUsername(event.target.value)}
        placeholder="Username or email"
        aria-label="Username or email"
        spellCheck={false}
        autoComplete="off"
        className={FIELD_CLASS}
      />
      <input
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Password"
        aria-label="Password"
        spellCheck={false}
        autoComplete="off"
        className={FIELD_CLASS}
      />
      <Button
        variant="secondary"
        icon="sparkles"
        loading={generating}
        onClick={() => void generate()}
      >
        Generate
      </Button>
      <Button type="submit" variant="primary" icon="plus" loading={saving} disabled={!canSave}>
        Save
      </Button>
    </form>
  );
}

/* ------------------------------------------------------------------ *
 * Password row
 * ------------------------------------------------------------------ */

function PasswordRow({
  entry,
  onRemoved,
}: {
  entry: PasswordEntry;
  onRemoved: () => void;
}): ReactElement {
  const [revealed, setRevealed] = useState<string | null>(null);
  const [knownLength, setKnownLength] = useState<number | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const host = getHostname(entry.origin) || entry.origin;
  const initial = (host.replace(/^www\./, '')[0] ?? '?').toUpperCase();
  const dots = '•'.repeat(knownLength ?? approximateLength(entry.passwordCipher));

  const revealPassword = async (): Promise<string | null> => {
    try {
      const { password } = await trpc.vault.reveal.mutate({ entryId: entry.id });
      setKnownLength(password.length);
      return password;
    } catch (caught) {
      toast.error('Could not reveal password', { description: messageOf(caught) });
      return null;
    }
  };

  const toggleReveal = async (): Promise<void> => {
    if (revealed !== null) {
      setRevealed(null);
      return;
    }
    setRevealing(true);
    const password = await revealPassword();
    if (password !== null) setRevealed(password);
    setRevealing(false);
  };

  const copyPassword = async (): Promise<void> => {
    const password = revealed ?? (await revealPassword());
    if (password === null) return;
    try {
      await navigator.clipboard.writeText(password);
      toast.success('Password copied');
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (caught) {
      toast.error('Could not copy password', { description: messageOf(caught) });
    }
  };

  const remove = async (): Promise<void> => {
    try {
      await trpc.vault.remove.mutate({ entryId: entry.id });
      toast.success('Password removed');
      onRemoved();
    } catch (caught) {
      toast.error('Could not remove password', { description: messageOf(caught) });
    }
  };

  return (
    <>
      <ListRow
        leading={
          <IconTile size="sm">
            <span className="text-xs font-semibold text-muted">{initial}</span>
          </IconTile>
        }
        title={host}
        subtitle={entry.username || 'No username'}
        meta={
          <span
            className={cn(
              'block max-w-[180px] truncate font-mono text-xs',
              revealed !== null ? 'text-text select-all' : 'text-faint',
            )}
          >
            {revealed ?? dots}
          </span>
        }
        actions={
          <>
            <IconButton size="sm" aria-label="Copy password" onClick={() => void copyPassword()}>
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </IconButton>
            <IconButton
              size="sm"
              aria-label={revealed !== null ? 'Hide password' : 'Show password'}
              disabled={revealing}
              onClick={() => void toggleReveal()}
            >
              {revealing ? (
                <Spinner size={15} />
              ) : revealed !== null ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </IconButton>
            <IconButton
              size="sm"
              aria-label={`Remove password for ${host}`}
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
            </IconButton>
          </>
        }
      />
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Remove password?"
        description={`The saved credential for ${host} will be permanently deleted from this vault.`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => void remove()}
      />
    </>
  );
}

/* ------------------------------------------------------------------ *
 * Unlocked vault
 * ------------------------------------------------------------------ */

function LoadingRows(): ReactElement {
  return (
    <ListContainer>
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 px-3"
          style={{ paddingBlock: 'var(--row-py)' }}
        >
          <Skeleton className="h-8 w-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-3 w-24" />
        </div>
      ))}
    </ListContainer>
  );
}

function UnlockedVault({
  profileId,
  vault,
}: {
  profileId: string;
  vault: VaultState;
}): ReactElement {
  const originRef = useRef<HTMLInputElement>(null);
  const [locking, setLocking] = useState(false);
  const {
    status,
    data: entries,
    error,
    reload,
  } = useAsyncData<PasswordEntry[]>(() => trpc.vault.list.query({ profileId }), [profileId], []);

  const count = status === 'ready' ? entries.length : vault.entryCount;

  const lock = async (): Promise<void> => {
    setLocking(true);
    try {
      await trpc.vault.lock.mutate({ profileId });
    } catch (caught) {
      toast.error('Could not lock the vault', { description: messageOf(caught) });
      setLocking(false);
    }
  };

  function renderBody(): ReactElement {
    if (status === 'loading' && entries.length === 0) return <LoadingRows />;
    if (status === 'error') {
      return (
        <EmptyState
          icon="triangle-alert"
          title="Couldn't load passwords"
          description={error ?? undefined}
          action={
            <Button icon="rotate-cw" onClick={reload}>
              Retry
            </Button>
          }
        />
      );
    }
    if (entries.length === 0) {
      return (
        <EmptyState
          icon="key-round"
          title="No passwords saved"
          description="Add a credential above and it will be encrypted locally, ready to autofill."
          action={
            <Button variant="primary" icon="plus" onClick={() => originRef.current?.focus()}>
              Add password
            </Button>
          }
        />
      );
    }
    return (
      <ListContainer>
        {entries.map((entry) => (
          <PasswordRow key={entry.id} entry={entry} onRemoved={reload} />
        ))}
      </ListContainer>
    );
  }

  return (
    <PageShell
      title="Passwords"
      description={`${vault.hardwareBacked ? 'OS-encrypted' : 'Encrypted'} vault · ${plural(count, 'password')}`}
      icon={<KeyRound className="h-5 w-5" />}
      actions={
        <Button
          variant="secondary"
          size="sm"
          icon="lock"
          loading={locking}
          onClick={() => void lock()}
        >
          Lock
        </Button>
      }
    >
      <AddPasswordForm profileId={profileId} onAdded={reload} originRef={originRef} />
      <div className="mt-5">{renderBody()}</div>
    </PageShell>
  );
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export function PasswordsPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const vault = useBrowserStore((state) => state.vault);

  if (!profile) {
    return (
      <PageShell title="Passwords" icon={<KeyRound className="h-5 w-5" />}>
        <EmptyState
          icon="key-round"
          title="No profile"
          description="Select a profile to view its saved passwords."
        />
      </PageShell>
    );
  }

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

  return <UnlockedVault profileId={profile.id} vault={vault} />;
}
