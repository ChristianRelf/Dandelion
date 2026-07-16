import type { ReactElement } from 'react';
import { ShieldCheck, Trash2 } from 'lucide-react';
import type { PermissionDecision, PermissionType, SitePermissionRule } from '@shared/types';
import { PageShell } from './PageShell';
import { Button } from '../components/ui/Button';
import { IconButton } from '../components/ui/IconButton';
import { IconTile } from '../components/ui/IconTile';
import { Icon } from '../components/ui/Icon';
import { EmptyState } from '../components/ui/EmptyState';
import { ListContainer, ListRow } from '../components/ui/List';
import { SegmentedControl } from '../components/ui/SegmentedControl';
import { Skeleton } from '../components/ui/Skeleton';
import { useAsyncData } from '../hooks/useAsyncData';
import { trpc } from '../lib/trpc/client';
import { useBrowserStore } from '../stores/browser.store';
import { toast } from '../stores/toast.store';

const DECISION_OPTIONS: Array<{ value: PermissionDecision; label: string }> = [
  { value: 'allow', label: 'Allow' },
  { value: 'ask', label: 'Ask' },
  { value: 'block', label: 'Block' },
];

/** Friendly labels for each permission type (e.g. `camera` → `Camera`). */
const TYPE_LABELS: Record<PermissionType, string> = {
  camera: 'Camera',
  microphone: 'Microphone',
  geolocation: 'Location',
  notifications: 'Notifications',
  'clipboard-read': 'Clipboard (read)',
  'clipboard-write': 'Clipboard (write)',
  midi: 'MIDI devices',
  bluetooth: 'Bluetooth',
  usb: 'USB devices',
  serial: 'Serial ports',
  hid: 'HID devices',
  filesystem: 'File system',
  'idle-detection': 'Idle detection',
  popups: 'Pop-ups',
  autoplay: 'Autoplay',
  'pointer-lock': 'Pointer lock',
  fullscreen: 'Fullscreen',
  'display-capture': 'Screen capture',
  'persistent-storage': 'Persistent storage',
};

/** Leading Lucide icon (kebab name) for each permission type. */
const TYPE_ICONS: Record<PermissionType, string> = {
  camera: 'camera',
  microphone: 'mic',
  geolocation: 'map-pin',
  notifications: 'bell',
  'clipboard-read': 'clipboard',
  'clipboard-write': 'clipboard',
  midi: 'piano',
  bluetooth: 'bluetooth',
  usb: 'usb',
  serial: 'cable',
  hid: 'gamepad-2',
  filesystem: 'folder',
  'idle-detection': 'clock',
  popups: 'app-window',
  autoplay: 'play',
  'pointer-lock': 'mouse-pointer-2',
  fullscreen: 'maximize',
  'display-capture': 'monitor',
  'persistent-storage': 'database',
};

function humanizeType(type: string): string {
  if (type in TYPE_LABELS) return TYPE_LABELS[type as PermissionType];
  const spaced = type.replace(/[-_]/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function iconForType(type: string): string {
  return type in TYPE_ICONS ? TYPE_ICONS[type as PermissionType] : 'shield';
}

function PermissionsSkeleton(): ReactElement {
  return (
    <ListContainer>
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center gap-3 border-b border-line px-3 last:border-b-0"
          style={{ paddingBlock: 'var(--row-py)' }}
        >
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-48" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-7 w-40 rounded-lg" />
        </div>
      ))}
    </ListContainer>
  );
}

export function PermissionsPage(): ReactElement {
  const profile = useBrowserStore((state) => state.profile);
  const {
    status,
    data: rules,
    error,
    reload,
  } = useAsyncData<SitePermissionRule[]>(
    () => (profile ? trpc.permissions.list.query({ profileId: profile.id }) : Promise.resolve([])),
    [profile?.id],
    [],
  );

  const setDecision = (rule: SitePermissionRule, decision: PermissionDecision): void => {
    if (!profile || decision === rule.decision) return;
    void trpc.permissions.set
      .mutate({ profileId: profile.id, origin: rule.origin, type: rule.type, decision })
      .then(() => reload())
      .catch(() => toast.error('Could not update permission'));
  };

  const remove = (rule: SitePermissionRule): void => {
    void trpc.permissions.remove
      .mutate({ id: rule.id })
      .then(() => reload())
      .catch(() => toast.error('Could not remove permission'));
  };

  let body: ReactElement;
  if (status === 'loading' && rules.length === 0) {
    body = <PermissionsSkeleton />;
  } else if (status === 'error' && rules.length === 0) {
    body = (
      <EmptyState
        icon="triangle-alert"
        title="Couldn't load permissions"
        description={error ?? 'Something went wrong.'}
        action={
          <Button variant="secondary" size="sm" icon="rotate-ccw" onClick={reload}>
            Retry
          </Button>
        }
      />
    );
  } else if (rules.length === 0) {
    body = (
      <EmptyState
        icon="shield-check"
        title="No site permissions"
        description="Sites you grant camera, microphone, or location access will appear here."
      />
    );
  } else {
    body = (
      <ListContainer>
        {rules.map((rule) => {
          const typeLabel = humanizeType(rule.type);
          return (
            <ListRow
              key={rule.id}
              leading={
                <IconTile>
                  <Icon name={iconForType(rule.type)} className="h-4 w-4" />
                </IconTile>
              }
              title={rule.origin}
              subtitle={typeLabel}
              meta={
                <SegmentedControl
                  value={rule.decision}
                  options={DECISION_OPTIONS}
                  onChange={(decision) => setDecision(rule, decision)}
                  aria-label={`${typeLabel} access for ${rule.origin}`}
                  size="sm"
                />
              }
              actions={
                <IconButton
                  size="sm"
                  aria-label={`Remove ${typeLabel} rule for ${rule.origin}`}
                  title="Remove"
                  onClick={() => remove(rule)}
                >
                  <Trash2 className="h-4 w-4" />
                </IconButton>
              }
            />
          );
        })}
      </ListContainer>
    );
  }

  return (
    <PageShell
      title="Site permissions"
      description="Control what each site is allowed to do."
      icon={<ShieldCheck className="h-5 w-5" />}
    >
      {body}
    </PageShell>
  );
}
