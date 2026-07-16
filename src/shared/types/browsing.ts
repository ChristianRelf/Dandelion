import type {
  BookmarkFolderId,
  BookmarkId,
  DownloadId,
  HistoryEntryId,
  ProfileId,
  VisitId,
  WorkspaceId,
} from './ids';

/* ------------------------------------------------------------------ *
 * Bookmarks
 * ------------------------------------------------------------------ */

export interface BookmarkFolder {
  id: BookmarkFolderId;
  profileId: ProfileId;
  parentId: BookmarkFolderId | null;
  name: string;
  index: number;
  createdAt: number;
}

export interface Bookmark {
  id: BookmarkId;
  profileId: ProfileId;
  folderId: BookmarkFolderId | null;
  /** Optional workspace association for space-scoped bookmark collections. */
  workspaceId: WorkspaceId | null;
  url: string;
  title: string;
  favicon: string | null;
  description: string | null;
  tags: string[];
  index: number;
  createdAt: number;
  updatedAt: number;
}

/* ------------------------------------------------------------------ *
 * History
 * ------------------------------------------------------------------ */

export type VisitTransition =
  'link' | 'typed' | 'bookmark' | 'reload' | 'form_submit' | 'redirect' | 'generated';

/** A deduplicated URL the user has visited, with aggregate visit statistics. */
export interface HistoryEntry {
  id: HistoryEntryId;
  profileId: ProfileId;
  url: string;
  title: string;
  favicon: string | null;
  visitCount: number;
  typedCount: number;
  lastVisitedAt: number;
}

/** A single visit event, linked to a {@link HistoryEntry}. */
export interface HistoryVisit {
  id: VisitId;
  entryId: HistoryEntryId;
  workspaceId: WorkspaceId | null;
  visitedAt: number;
  transition: VisitTransition;
  referrerVisitId: VisitId | null;
  durationMs: number | null;
}

/* ------------------------------------------------------------------ *
 * Downloads
 * ------------------------------------------------------------------ */

export type DownloadState = 'in_progress' | 'paused' | 'completed' | 'cancelled' | 'interrupted';

/** Result of the pluggable safety-scanning hook. */
export type DownloadSafety = 'unknown' | 'scanning' | 'safe' | 'malicious';

export interface Download {
  id: DownloadId;
  profileId: ProfileId;
  url: string;
  filename: string;
  savePath: string;
  mimeType: string;
  state: DownloadState;
  receivedBytes: number;
  totalBytes: number;
  /** Instantaneous transfer rate in bytes/second. */
  speed: number;
  /** Estimated seconds to completion, or `null` when unknown. */
  etaSeconds: number | null;
  paused: boolean;
  canResume: boolean;
  safety: DownloadSafety;
  referrer: string | null;
  startedAt: number;
  completedAt: number | null;
}
