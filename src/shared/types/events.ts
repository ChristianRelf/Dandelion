import type { TabGroupId, TabId, WindowId, WorkspaceId } from './ids';
import type { Tab, TabGroup, TabNavigationState } from './tab';
import type { Download } from './browsing';
import type { WindowState } from './window';
import type { Workspace } from './workspace';
import type { VaultState } from './vault';
import type { PermissionType, ShieldReport } from './privacy';
import type { AiStreamChunk } from './ai';
import type { UpdateStatus } from './update';

export interface PermissionRequest {
  id: string;
  tabId: TabId;
  origin: string;
  type: PermissionType;
}

export interface FindResult {
  tabId: TabId;
  activeMatchOrdinal: number;
  matches: number;
}

/**
 * The discriminated union of all main → renderer push notifications, delivered
 * over the dedicated event channel (see `shared/ipc/channels`). The renderer's
 * event bridge narrows on `type` to update the appropriate Zustand store.
 */
export type BrowserEvent =
  | { type: 'tab:created'; tab: Tab }
  | { type: 'tab:updated'; tab: Tab }
  | { type: 'tab:removed'; tabId: TabId; workspaceId: WorkspaceId }
  | { type: 'tab:activated'; tabId: TabId; windowId: WindowId }
  | {
      type: 'tab:navigation';
      tabId: TabId;
      url: string;
      title: string;
      navigation: TabNavigationState;
    }
  | { type: 'tabGroup:changed'; group: TabGroup }
  | { type: 'tabGroup:removed'; groupId: TabGroupId; workspaceId: WorkspaceId }
  | { type: 'workspace:changed'; workspace: Workspace }
  | { type: 'workspace:activated'; workspaceId: WorkspaceId; windowId: WindowId }
  | { type: 'download:created'; download: Download }
  | { type: 'download:updated'; download: Download }
  | { type: 'window:state'; window: WindowState }
  | { type: 'permission:request'; request: PermissionRequest }
  | { type: 'vault:state'; state: VaultState }
  | { type: 'shield:report'; tabId: TabId; report: ShieldReport }
  | { type: 'find:result'; result: FindResult }
  | { type: 'ai:chunk'; chunk: AiStreamChunk }
  /** The whole updater state, whenever any of it moves. */
  | { type: 'app:update-status'; status: UpdateStatus }
  | { type: 'app:command'; commandId: string };

export type BrowserEventType = BrowserEvent['type'];

/** Extract the concrete payload for a given event `type`. */
export type BrowserEventOf<T extends BrowserEventType> = Extract<BrowserEvent, { type: T }>;
