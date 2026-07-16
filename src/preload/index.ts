import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC } from '@shared/ipc/channels';
import { APP_VERSION } from '@shared/constants/app';
import type { DandelionBridge, PlatformOS } from '@shared/ipc/bridge';
import type { BrowserEvent } from '@shared/types';
import type { IpcTrpcOp, IpcTrpcResult } from '@shared/ipc/contract';

/**
 * The context-isolated bridge. Runs in a sandboxed preload, so it may only use
 * the `electron` renderer APIs and pure bundled code — no Node built-ins. It
 * exposes exactly the {@link DandelionBridge} surface and nothing else.
 */
const WINDOW_ID_FLAG = '--dandelion-window-id=';
const windowId =
  process.argv.find((arg) => arg.startsWith(WINDOW_ID_FLAG))?.slice(WINDOW_ID_FLAG.length) ?? '';

const bridge: DandelionBridge = {
  windowId,
  trpc: {
    invoke: (op: IpcTrpcOp): Promise<IpcTrpcResult> => ipcRenderer.invoke(IPC.trpc, op),
  },
  events: {
    subscribe(handler: (event: BrowserEvent) => void): () => void {
      const listener = (_event: IpcRendererEvent, payload: BrowserEvent): void => handler(payload);
      ipcRenderer.on(IPC.event, listener);
      return () => {
        ipcRenderer.off(IPC.event, listener);
      };
    },
  },
  platform: {
    os: process.platform as PlatformOS,
    arch: process.arch,
    isMac: process.platform === 'darwin',
    isWindows: process.platform === 'win32',
    isLinux: process.platform === 'linux',
    appVersion: APP_VERSION,
  },
};

contextBridge.exposeInMainWorld('dandelion', bridge);
