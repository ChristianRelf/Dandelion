import { EventEmitter } from 'node:events';
import type { BrowserEvent } from '@shared/types';

type Handler = (event: BrowserEvent) => void;

/**
 * The main-process publish/subscribe hub for {@link BrowserEvent}s. Services and
 * managers publish domain events here; the IPC host subscribes and forwards them
 * to every chrome renderer. Keeping this in one place means no service needs a
 * direct reference to Electron `webContents`.
 */
export class EventBus {
  private readonly emitter = new EventEmitter();

  constructor() {
    // Browsers open many tabs → many concurrent listeners are expected.
    this.emitter.setMaxListeners(0);
  }

  emit(event: BrowserEvent): void {
    this.emitter.emit('event', event);
  }

  subscribe(handler: Handler): () => void {
    this.emitter.on('event', handler);
    return () => {
      this.emitter.off('event', handler);
    };
  }
}
