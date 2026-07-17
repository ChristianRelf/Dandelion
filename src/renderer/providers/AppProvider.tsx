import { useEffect, type ReactElement, type ReactNode } from 'react';
import { MotionConfig } from 'motion/react';
import { selectAccent, useBrowserStore } from '../stores/browser.store';
import { useDownloadsStore } from '../stores/downloads.store';
import { useAiStore } from '../stores/ai.store';
import { useReaderStore } from '../stores/reader.store';
import { selectContentDimmed, useUiStore } from '../stores/ui.store';
import { useUpdateStore } from '../stores/update.store';
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
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const reduceMotion = settings?.appearance.reduceMotion ?? false;
  const dimmed = useUiStore(selectContentDimmed);
  const readerTabId = useReaderStore((state) => state.tabId);
  // The native web view must be hidden while an overlay is up or reader mode
  // has replaced the active tab's content.
  const hideContent = dimmed || (readerTabId !== null && readerTabId === activeTabId);

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
        // A download starting is the one moment the bubble should appear on its
        // own — that is what makes it progress feedback rather than a menu.
        if (event.type === 'download:created') {
          useUiStore.getState().setDownloadsPopoverOpen(true);
        }
        if (event.type === 'ai:chunk') useAiStore.getState().applyChunk(event.chunk);
        if (event.type === 'ai:providers') useAiStore.getState().setProviders(event.providers);
        if (event.type === 'tab:updated') {
          // A navigation invalidates the distilled reader content for that tab.
          const reader = useReaderStore.getState();
          if (reader.tabId === event.tab.id && event.tab.status === 'loading') reader.close();
        }
        if (event.type === 'app:update-status') {
          useUpdateStore.getState().setStatus(event.status);
        }
        if (event.type === 'app:command') handleUiCommand(event.commandId);
      }),
    [],
  );

  // An update may already be downloading, or waiting, from before this window
  // opened — a second window must not appear to have missed it.
  useEffect(() => {
    void useUpdateStore.getState().hydrate();
  }, []);

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
    void trpc.layout.setContentVisible.mutate({ visible: !hideContent });
  }, [hideContent, windowId]);

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
