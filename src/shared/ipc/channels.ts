/**
 * The complete set of low-level Electron IPC channels. Everything else in the
 * app is layered on top of just these two:
 *
 *  - `trpc`  — renderer → main request/response (via `ipcRenderer.invoke`), the
 *              transport for the typed tRPC router.
 *  - `event` — main → renderer push of {@link BrowserEvent}s.
 */
export const IPC = {
  trpc: 'dandelion:trpc',
  event: 'dandelion:event',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
