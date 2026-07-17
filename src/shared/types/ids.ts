/**
 * String identifier aliases for the domain model.
 *
 * We deliberately use plain string aliases rather than branded types: identifiers
 * cross the IPC boundary constantly and are persisted as SQLite `TEXT`, so the
 * ergonomic cost of branding outweighs the safety benefit here. Intent is
 * documented through naming and validated at the edges with Zod.
 */

export type ProfileId = string;
export type WorkspaceId = string;
export type WindowId = string;
export type TabId = string;
export type TabGroupId = string;
export type BookmarkId = string;
export type BookmarkFolderId = string;
export type ReadingItemId = string;
export type NoteId = string;
export type HistoryEntryId = string;
export type VisitId = string;
export type DownloadId = string;
export type PasswordEntryId = string;
export type PermissionRuleId = string;
export type SearchEngineId = string;
export type ExtensionId = string;
export type PromptTemplateId = string;
export type SessionSnapshotId = string;
export type CookieId = string;
