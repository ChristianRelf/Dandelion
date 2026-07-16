import type { BrowserEvent } from '../types/events';
import type { IpcTrpcOp, IpcTrpcResult } from './contract';

export type PlatformOS = 'win32' | 'darwin' | 'linux';

export interface BridgePlatform {
  os: PlatformOS;
  arch: string;
  isMac: boolean;
  isWindows: boolean;
  isLinux: boolean;
  appVersion: string;
}

/**
 * The API surface exposed to the chrome renderer via `contextBridge`. It is
 * deliberately tiny: a single tRPC transport, an event subscription, and static
 * platform metadata. Everything else flows through the typed tRPC router.
 */
export interface DandelionBridge {
  /** The id of the window hosting this renderer, injected at window creation. */
  windowId: string;
  trpc: {
    invoke(op: IpcTrpcOp): Promise<IpcTrpcResult>;
  };
  events: {
    /** Subscribe to main → renderer push events. Returns an unsubscribe fn. */
    subscribe(handler: (event: BrowserEvent) => void): () => void;
  };
  platform: BridgePlatform;
}

declare global {
  interface Window {
    dandelion: DandelionBridge;
  }
}
