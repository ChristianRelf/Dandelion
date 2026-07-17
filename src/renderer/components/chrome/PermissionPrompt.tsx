import { useEffect, useRef, useState, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ShieldQuestion } from 'lucide-react';
import type { PermissionRequest } from '@shared/types';
import { Button } from '../ui/Button';
import { trpc } from '../../lib/trpc/client';
import { onBrowserEventOf } from '../../lib/events';
import { useBrowserStore } from '../../stores/browser.store';
import { useUiStore } from '../../stores/ui.store';

const PERMISSION_LABELS: Partial<Record<string, string>> = {
  camera: 'use your camera',
  microphone: 'use your microphone',
  geolocation: 'know your location',
  notifications: 'send notifications',
  'clipboard-read': 'read your clipboard',
  midi: 'use MIDI devices',
  bluetooth: 'use Bluetooth',
  usb: 'connect to USB devices',
  serial: 'access serial ports',
  hid: 'access HID devices',
};

/** Site permission request prompt (camera, mic, location, …). */
export function PermissionPrompt(): ReactElement {
  const [queue, setQueue] = useState<PermissionRequest[]>([]);
  const setPermissionActive = useUiStore((state) => state.setPermissionActive);
  const windowId = useBrowserStore((state) => state.windowId);
  const allowRef = useRef<HTMLButtonElement>(null);
  const request = queue[0] ?? null;

  useEffect(
    () =>
      onBrowserEventOf('permission:request', (event) => {
        // Every window receives the event. Only the one holding the tab that
        // asked may answer for it: the others would show a consent prompt, with
        // "Allow" pre-focused, for a site their user is not even looking at.
        if (event.request.windowId !== windowId) return;
        setQueue((current) => [...current, event.request]);
      }),
    [windowId],
  );

  useEffect(() => {
    setPermissionActive(queue.length > 0);
    return () => setPermissionActive(false);
  }, [queue.length, setPermissionActive]);

  useEffect(() => {
    if (request) requestAnimationFrame(() => allowRef.current?.focus());
  }, [request]);

  const respond = (decision: 'allow' | 'block', remember: boolean): void => {
    if (request) {
      void trpc.permissions.respond.mutate({ requestId: request.id, decision, remember });
    }
    setQueue((current) => current.slice(1));
  };

  return (
    <AnimatePresence>
      {request && (
        <motion.div
          key={request.id}
          role="alertdialog"
          aria-label="Permission request"
          onKeyDown={(event) => {
            if (event.key === 'Escape') respond('block', false);
          }}
          className="absolute top-6 left-1/2 z-50 w-[400px] max-w-[92%] -translate-x-1/2 rounded-2xl border border-line p-4 shadow-[var(--shadow-lg)] glass-strong"
          initial={{ opacity: 0, y: -10, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.98 }}
          transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
              <ShieldQuestion className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] leading-relaxed text-text">
                <span className="font-medium break-all">{request.origin}</span> wants to{' '}
                {PERMISSION_LABELS[request.type] ?? `use ${request.type}`}.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  ref={allowRef}
                  variant="primary"
                  size="sm"
                  onClick={() => respond('allow', true)}
                >
                  Allow
                </Button>
                <Button variant="secondary" size="sm" onClick={() => respond('allow', false)}>
                  Allow this time
                </Button>
                <Button variant="ghost" size="sm" onClick={() => respond('block', true)}>
                  Block
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
