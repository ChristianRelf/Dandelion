import type { BrowserEvent, BrowserEventOf, BrowserEventType } from '@shared/types';

/** Subscribe to all main → renderer push events. Returns an unsubscribe fn. */
export function onBrowserEvent(handler: (event: BrowserEvent) => void): () => void {
  return window.dandelion.events.subscribe(handler);
}

/** Subscribe to a single event `type` with a narrowed payload. */
export function onBrowserEventOf<T extends BrowserEventType>(
  type: T,
  handler: (event: BrowserEventOf<T>) => void,
): () => void {
  return window.dandelion.events.subscribe((event) => {
    if (event.type === type) handler(event as BrowserEventOf<T>);
  });
}
