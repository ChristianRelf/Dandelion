import type { Db } from '../database';
import { ProfilesRepository } from './profiles.repo';
import { WorkspacesRepository } from './workspaces.repo';
import { TabsRepository } from './tabs.repo';
import { HistoryRepository } from './history.repo';
import { BookmarksRepository } from './bookmarks.repo';
import { DownloadsRepository } from './downloads.repo';
import { PermissionsRepository } from './permissions.repo';
import { PasswordsRepository } from './passwords.repo';
import { SearchEnginesRepository } from './search-engines.repo';
import { SettingsRepository } from './settings.repo';
import { SessionsRepository } from './sessions.repo';
import { KvRepository } from './kv.repo';

/**
 * The single access point to all persistence. Constructed once with the open
 * {@link Db} and injected into the services that need it.
 */
export class Repositories {
  readonly profiles: ProfilesRepository;
  readonly workspaces: WorkspacesRepository;
  readonly tabs: TabsRepository;
  readonly history: HistoryRepository;
  readonly bookmarks: BookmarksRepository;
  readonly downloads: DownloadsRepository;
  readonly permissions: PermissionsRepository;
  readonly passwords: PasswordsRepository;
  readonly searchEngines: SearchEnginesRepository;
  readonly settings: SettingsRepository;
  readonly sessions: SessionsRepository;
  readonly kv: KvRepository;

  constructor(db: Db) {
    const raw = db.raw;
    this.profiles = new ProfilesRepository(raw);
    this.workspaces = new WorkspacesRepository(raw);
    this.tabs = new TabsRepository(raw);
    this.history = new HistoryRepository(raw);
    this.bookmarks = new BookmarksRepository(raw);
    this.downloads = new DownloadsRepository(raw);
    this.permissions = new PermissionsRepository(raw);
    this.passwords = new PasswordsRepository(raw);
    this.searchEngines = new SearchEnginesRepository(raw);
    this.settings = new SettingsRepository(raw);
    this.sessions = new SessionsRepository(raw);
    this.kv = new KvRepository(raw);
  }
}

export { ProfilesRepository } from './profiles.repo';
export { WorkspacesRepository } from './workspaces.repo';
export { TabsRepository, type PersistedTab } from './tabs.repo';
export { HistoryRepository, type RecordVisitParams } from './history.repo';
export { BookmarksRepository } from './bookmarks.repo';
export { DownloadsRepository, type DownloadPatch } from './downloads.repo';
export { PermissionsRepository } from './permissions.repo';
export { PasswordsRepository, type VaultMeta } from './passwords.repo';
export { SearchEnginesRepository } from './search-engines.repo';
export { SettingsRepository } from './settings.repo';
export { SessionsRepository } from './sessions.repo';
export { KvRepository } from './kv.repo';
