import { useState, type ReactElement } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import type { WallpaperKind, Workspace, WorkspaceWallpaper } from '@shared/types';
import { COLOR_PRESETS, DEFAULT_WALLPAPER, GRADIENT_PRESETS } from '@shared/constants';
import { cn } from '../../lib/cn';
import { wallpaperBackground, wallpaperBlur } from '../../lib/wallpaper';
import { Button } from '../ui/Button';
import { ColorPicker } from '../ui/ColorPicker';
import { Icon } from '../ui/Icon';
import { SegmentedControl } from '../ui/SegmentedControl';
import { Slider } from '../ui/Slider';
import { toast } from '../../stores/toast.store';
import { trpc } from '../../lib/trpc/client';

interface WallpaperDialogProps {
  workspace: Workspace | null;
  onClose: () => void;
  /** Re-read the spaces after a change lands. */
  onSaved: () => Promise<void> | void;
}

const KIND_OPTIONS: { value: WallpaperKind; label: string; icon: string }[] = [
  { value: 'color', label: 'Colour', icon: 'paintbrush' },
  { value: 'gradient', label: 'Gradient', icon: 'blend' },
  { value: 'image', label: 'Image', icon: 'image' },
];

/**
 * Picker for a space's wallpaper.
 *
 * Edits are held locally and committed on Save rather than written through on
 * every slider tick — a colour well fires continuously while dragging, and each
 * write is an IPC round-trip, a SQLite write and a `workspace:changed` broadcast
 * to every window.
 */
export function WallpaperDialog({
  workspace,
  onClose,
  onSaved,
}: WallpaperDialogProps): ReactElement {
  const [draft, setDraft] = useState<WorkspaceWallpaper | null>(null);
  const [picking, setPicking] = useState(false);
  const [saving, setSaving] = useState(false);

  // `workspace` becoming non-null is the open; seed the draft from it once.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (workspace && seededFor !== workspace.id) {
    setSeededFor(workspace.id);
    setDraft(workspace.wallpaper ?? DEFAULT_WALLPAPER);
  }

  const patch = (next: Partial<WorkspaceWallpaper>): void =>
    setDraft((current) => (current ? ({ ...current, ...next } as WorkspaceWallpaper) : current));

  /**
   * Switching kind keeps blur/dim but needs a `value` of the new kind's
   * grammar — the schema rejects a hex colour under `kind: 'gradient'`, as it
   * should.
   */
  const setKind = (kind: WallpaperKind): void => {
    if (!draft || draft.kind === kind) return;
    if (kind === 'color') patch({ kind, value: COLOR_PRESETS[0] });
    else if (kind === 'gradient') patch({ kind, value: GRADIENT_PRESETS[0]?.value });
    else patch({ kind, value: '' });
  };

  const pickImage = async (): Promise<void> => {
    setPicking(true);
    try {
      const file = await trpc.workspaces.pickWallpaperImage.mutate();
      if (file) patch({ kind: 'image', value: file });
    } catch {
      toast.error('Could not load that image');
    } finally {
      setPicking(false);
    }
  };

  const save = async (): Promise<void> => {
    if (!workspace || !draft) return;
    if (draft.kind === 'image' && !draft.value) {
      toast.error('Choose an image first');
      return;
    }
    setSaving(true);
    try {
      await trpc.workspaces.update.mutate({ workspaceId: workspace.id, wallpaper: draft });
      await onSaved();
      onClose();
    } catch {
      toast.error('Could not update wallpaper');
    } finally {
      setSaving(false);
    }
  };

  const clear = async (): Promise<void> => {
    if (!workspace) return;
    setSaving(true);
    try {
      await trpc.workspaces.update.mutate({ workspaceId: workspace.id, wallpaper: null });
      await onSaved();
      onClose();
    } catch {
      toast.error('Could not remove wallpaper');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={workspace !== null} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm data-[state=open]:animate-[fade-in_120ms_ease-out]" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[101] w-[420px] max-w-[92vw] animate-pop -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line p-5 shadow-[var(--shadow-lg)] glass-strong">
          <Dialog.Title className="text-[15px] font-semibold text-text">Wallpaper</Dialog.Title>
          <Dialog.Description className="mt-1 text-xs text-muted">
            Shown behind the new tab page in {workspace?.name ?? 'this space'}.
          </Dialog.Description>

          {draft && (
            <>
              <div
                aria-hidden
                className="relative mt-4 h-28 w-full overflow-hidden rounded-xl border border-line"
              >
                {draft.kind === 'image' && !draft.value ? (
                  <div className="flex h-full items-center justify-center text-xs text-faint">
                    No image chosen
                  </div>
                ) : (
                  <>
                    <div
                      className="absolute inset-0"
                      style={{
                        background: wallpaperBackground(draft),
                        filter: wallpaperBlur(draft),
                        transform: draft.blur > 0 ? 'scale(1.1)' : undefined,
                      }}
                    />
                    <div className="absolute inset-0 bg-bg" style={{ opacity: draft.dim }} />
                  </>
                )}
              </div>

              <div className="mt-4">
                <SegmentedControl
                  aria-label="Wallpaper type"
                  value={draft.kind}
                  onChange={setKind}
                  options={KIND_OPTIONS}
                />
              </div>

              <div className="mt-4 min-h-[34px]">
                {draft.kind === 'color' && (
                  <ColorPicker
                    label="Wallpaper colour"
                    presets={COLOR_PRESETS}
                    value={draft.value}
                    onChange={(value) => patch({ value })}
                  />
                )}

                {draft.kind === 'gradient' && (
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Gradient">
                    {GRADIENT_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        aria-label={preset.label}
                        aria-pressed={draft.value === preset.value}
                        title={preset.label}
                        onClick={() => patch({ value: preset.value })}
                        style={{ backgroundImage: preset.value }}
                        className={cn(
                          'h-6 w-6 rounded-full transition-transform hover:scale-110',
                          draft.value === preset.value
                            ? 'shadow-[0_0_0_2px_var(--bg-elevated),0_0_0_4px_var(--text)]'
                            : 'shadow-[inset_0_0_0_1px_rgba(0,0,0,0.14)]',
                        )}
                      />
                    ))}
                  </div>
                )}

                {draft.kind === 'image' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon="image"
                    loading={picking}
                    onClick={() => void pickImage()}
                  >
                    {draft.value ? 'Choose a different image…' : 'Choose an image…'}
                  </Button>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-[13px] text-muted">Blur</span>
                <Slider
                  aria-label="Wallpaper blur"
                  value={draft.blur}
                  min={0}
                  max={100}
                  onValueChange={(blur) => patch({ blur })}
                  valueText={`${draft.blur} percent`}
                />
              </div>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="text-[13px] text-muted">Dim</span>
                <Slider
                  aria-label="Wallpaper dim"
                  value={Math.round(draft.dim * 100)}
                  min={0}
                  max={100}
                  onValueChange={(dim) => patch({ dim: dim / 100 })}
                  valueText={`${Math.round(draft.dim * 100)} percent`}
                />
              </div>
            </>
          )}

          <div className="mt-5 flex items-center justify-between gap-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={saving || !workspace?.wallpaper}
              onClick={() => void clear()}
            >
              <Icon name="trash-2" className="mr-1.5 h-3.5 w-3.5" />
              Remove
            </Button>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
              <Button variant="primary" size="sm" loading={saving} onClick={() => void save()}>
                Save
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
