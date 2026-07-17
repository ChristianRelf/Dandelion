import { useEffect, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import type { PopupKind, Settings } from '@shared/types';
import { trpc } from '../lib/trpc/client';
import { onBrowserEvent } from '../lib/events';
import { applyAppearance, watchSystemTheme } from '../lib/theme';
import { selectAccent, useBrowserStore } from '../stores/browser.store';
import { useDownloadsStore } from '../stores/downloads.store';
import { useUpdateStore } from '../stores/update.store';
import { DownloadsPopoverBody } from '../components/chrome/DownloadsPopover';
import { UpdateChipBody } from '../components/chrome/UpdateChip';
import { ZoomControlBody } from '../components/chrome/ZoomControl';

/**
 * Room for the card's shadow, matching `SHADOW_PAD` in `PopupHost`. The surface
 * is a rectangle, so a shadow drawn outside the card would be clipped by it.
 */
const SHADOW_PAD = 20;

function Body({ kind }: { kind: PopupKind }): ReactElement | null {
  if (kind === 'downloads') return <DownloadsPopoverBody />;
  if (kind === 'update') return <UpdateChipBody />;
  if (kind === 'zoom') return <ZoomControlBody />;
  return null;
}

/**
 * The renderer inside the popup surface — a second web contents floating above
 * the page, showing exactly one toolbar popover.
 *
 * It shares no React tree with the chrome, so it keeps its own stores. That costs
 * little to hold honest: the stores already load themselves over tRPC and follow
 * the same events, and `PopupHost` forwards the event bridge here precisely so
 * they can. Settings are the exception — nothing emits when they change — so they
 * are re-read each time the surface is shown, which is the only moment they can
 * be seen.
 */
export function PopupApp(): ReactElement | null {
  const [kind, setKind] = useState<PopupKind | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const windowId = window.dandelion.windowId;

  useEffect(
    () =>
      onBrowserEvent((event) => {
        if (event.type === 'download:created' || event.type === 'download:updated') {
          useDownloadsStore.getState().apply(event.download);
        }
        if (event.type === 'app:update-status') useUpdateStore.getState().setStatus(event.status);
        if (event.type === 'app:update-dismissed') {
          useUpdateStore.getState().dismiss(event.version);
        }
        if (event.type !== 'popup:show' || event.windowId !== windowId) return;

        if (!event.kind) {
          setKind(null);
          return;
        }
        // Re-read on the way in: the theme or accent may have moved while this
        // surface sat idle, and there is no event to have told it.
        void (async () => {
          const state = await trpc.app.initialState.query();
          useBrowserStore.setState({
            windowId: state.windowId ?? windowId,
            profile: state.profile,
            profiles: state.profiles,
            workspaces: state.workspaces,
            activeWorkspaceId: state.activeWorkspaceId,
            settings: state.settings,
            windowState: state.window,
            activeTabId: state.window?.activeTabId ?? null,
          });
          setSettings(state.settings);
          if (state.profile) void useDownloadsStore.getState().load(state.profile.id);
          void useUpdateStore.getState().hydrate();
          setKind(event.kind);
        })();
      }),
    [windowId],
  );

  useEffect(() => {
    if (!settings) return;
    applyAppearance(settings, selectAccent(useBrowserStore.getState()) ?? '#f5c451');
  }, [settings]);

  useEffect(() => {
    if (settings?.appearance.themeMode !== 'system') return;
    return watchSystemTheme(() => {
      const state = useBrowserStore.getState();
      if (state.settings) applyAppearance(state.settings, selectAccent(state) ?? '#f5c451');
    });
  }, [settings?.appearance.themeMode]);

  // Escape closes, as it does for every other overlay. The surface holds focus
  // while it is open, so the keydown lands here.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') void trpc.popup.close.mutate();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  // Report the card's size so main can place the surface and reveal it. Measured
  // rather than declared: the downloads list grows with its contents. Main keeps
  // the surface hidden until it hears a real size, so nothing flashes.
  useLayoutEffect(() => {
    const element = card.current;
    if (!element || !kind) return;
    const publish = (): void => {
      const rect = element.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) return;
      void trpc.popup.resize.mutate({
        width: Math.ceil(rect.width),
        height: Math.ceil(rect.height),
      });
    };
    publish();
    const observer = new ResizeObserver(publish);
    observer.observe(element);
    return () => observer.disconnect();
  }, [kind]);

  if (!kind || !settings) return null;

  return (
    <div style={{ padding: SHADOW_PAD }} className="flex items-start justify-start">
      <div
        ref={card}
        role="dialog"
        className="w-fit rounded-xl border border-line shadow-[var(--shadow-lg)] glass-strong"
      >
        <Body kind={kind} />
      </div>
    </div>
  );
}
