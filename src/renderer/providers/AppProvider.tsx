import { useEffect, type ReactElement, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { selectAccent, useBrowserStore } from '../stores/browser.store';
import { useDownloadsStore } from '../stores/downloads.store';
import { selectContentDimmed, useUiStore } from '../stores/ui.store';
import { onBrowserEvent } from '../lib/events';
import { applyAppearance, watchSystemTheme } from '../lib/theme';
import { handleUiCommand } from '../lib/commands';
import { trpc } from '../lib/trpc/client';
import { DandelionMark } from '../components/brand/DandelionMark';
import { ToastViewport } from '../components/ui/Toast';

function BootSplash(): ReactElement {
  return (
    <div className="flex h-full items-center justify-center bg-bg">
      <DandelionMark className="h-12 w-12 animate-pulse text-accent" />
    </div>
  );
}

/**
 * Bootstraps the window's state, bridges main → renderer events into the stores,
 * and keeps theme and web-content visibility in sync with settings and overlays.
 */
export function AppProvider({ children }: { children: ReactNode }): ReactElement {
  const ready = useBrowserStore((state) => state.ready);
  const settings = useBrowserStore((state) => state.settings);
  // The accent is derived to a plain string, so this effect only re-applies the
  // theme when the colour truly changes — not on every workspace event.
  const accent = useBrowserStore(selectAccent);
  const themeMode = settings?.appearance.themeMode;
  const windowId = useBrowserStore((state) => state.windowId);
  const profileId = useBrowserStore((state) => state.profile?.id);
  const reduceMotion = settings?.appearance.reduceMotion ?? false;
  const dimmed = useUiStore(selectContentDimmed);

  useEffect(() => {
    void useBrowserStore.getState().bootstrap();
  }, []);

  useEffect(
    () =>
      onBrowserEvent((event) => {
        useBrowserStore.getState().applyEvent(event);
        if (event.type === 'download:created' || event.type === 'download:updated') {
          useDownloadsStore.getState().apply(event.download);
        }
        if (event.type === 'app:command') handleUiCommand(event.commandId);
      }),
    [],
  );

  useEffect(() => {
    if (settings && accent) applyAppearance(settings, accent);
  }, [settings, accent]);

  // Re-skin live when the OS theme flips and we're following the system.
  useEffect(() => {
    if (themeMode !== 'system') return;
    return watchSystemTheme(() => {
      const state = useBrowserStore.getState();
      if (state.settings) applyAppearance(state.settings, selectAccent(state) ?? '#f5c451');
    });
  }, [themeMode]);

  useEffect(() => {
    if (!windowId) return;
    void trpc.layout.setContentVisible.mutate({ visible: !dimmed });
  }, [dimmed, windowId]);

  useEffect(() => {
    if (profileId) void useDownloadsStore.getState().load(profileId);
  }, [profileId]);

  if (!ready) return <BootSplash />;

  return (
    <MotionConfig reducedMotion={reduceMotion ? 'always' : 'never'}>
      {children}
      <ToastViewport />
    </MotionConfig>
  );
}
