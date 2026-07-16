import type { SessionSnapshotId, TabGroupId, WorkspaceId } from './ids';
import type { WindowBounds, WindowChromeState } from './window';

export interface SessionTab {
  url: string;
  title: string;
  favicon: string | null;
  workspaceId: WorkspaceId;
  groupId: TabGroupId | null;
  pinned: boolean;
  index: number;
  active: boolean;
}

export interface SessionWindow {
  bounds: WindowBounds;
  chromeState: WindowChromeState;
  activeWorkspaceId: WorkspaceId | null;
  tabLayout: 'vertical' | 'horizontal';
  tabs: SessionTab[];
}

export type SessionReason = 'auto' | 'manual' | 'shutdown';

/** A point-in-time snapshot of all windows/tabs used for crash and session restore. */
export interface SessionSnapshot {
  id: SessionSnapshotId;
  reason: SessionReason;
  createdAt: number;
  windows: SessionWindow[];
}

/** A lightweight description of a saved session for the sessions list. */
export interface SessionSummary {
  id: SessionSnapshotId;
  reason: SessionReason;
  createdAt: number;
  tabCount: number;
  /** A human-friendly title derived from the snapshot's tabs. */
  title: string;
}
